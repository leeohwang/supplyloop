// Isolated destructive-reset regression. No application credentials or hosted API.
// Node 22.20 fs/child_process and official PostgreSQL 17 docs checked 2026-10-24.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { buildPlan, renderCleanupSql, projectRef } from './reset-registrations.mjs';
import { schools } from '../../supabase/fixtures.mjs';

const runFile = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const localEnv = { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C', TZ: 'UTC' };
const stamp = '2026-10-24T18:00:00+00:00';
const tables = ['schools', 'memberships', 'items', 'item_staff', 'reservations', 'item_events'];
const users = schools.flatMap((school, index) => ['MANAGER', 'MEMBER1', 'MEMBER2'].map((suffix, accountIndex) => ({
  id: `aaaaaaaa-0000-4000-8000-00000000000${index * 3 + accountIndex + 1}`,
  email: `${school.slug}.${suffix.toLowerCase()}@supplyloop.example`,
  created_at: stamp,
  app_metadata: { supplyloop_demo_project: projectRef, fixture_key: `DEMO_${index === 0 ? 'A' : 'B'}_${suffix}` },
})));
users.push(...[1, 2].map(index => ({ id: `bbbbbbbb-0000-4000-8000-00000000000${index}`, email: `added${index}@supplyloop.example`, created_at: stamp, app_metadata: {} })));
const memberships = users.map((user, index) => ({
  school_id: index < 3 || index >= 6 ? schools[0].id : schools[1].id,
  user_id: user.id, role: index === 0 || index === 3 ? 'manager' : 'member', active: true,
  display_label: index < 6 ? `${index < 3 ? 'School A' : 'School B'} ${index % 3 === 0 ? 'manager' : `member ${index % 3}`}` : `Added O'Brien $reset$ \\ student ${index}`,
  created_at: stamp,
}));
const order = { schools: 'id', memberships: 'school_id, user_id', items: 'id', item_staff: 'school_id, item_id', reservations: 'id', item_events: 'id' };
let scratch;
let started = false;
let checks = 0;
async function run(command, args) {
  return runFile(command, args, { cwd: root, env: localEnv, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
}
function psqlArgs() { return ['-X', '--no-password', '-v', 'ON_ERROR_STOP=1', '-qAt', '-h', scratch, '-p', '55434', '-U', 'postgres', '-d', 'postgres']; }
async function sql(query) { return (await run('psql', [...psqlArgs(), '-c', query])).stdout.trim(); }
function literal(value) { return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`; }
async function snapshot() {
  return JSON.parse(await sql(`select pg_catalog.jsonb_build_object(${tables.map(table => `'${table}', (select coalesce(jsonb_agg(to_jsonb(t) order by ${order[table]}), '[]'::jsonb) from public.${table} as t)`).join(', ')});`));
}
async function completeState() {
  return JSON.parse(await sql(`select pg_catalog.jsonb_build_object('public', (${`select pg_catalog.jsonb_build_object(${tables.map(table => `'${table}', (select coalesce(jsonb_agg(to_jsonb(t) order by ${order[table]}), '[]'::jsonb) from public.${table} as t)`).join(', ')})`}),
    'auth', (select jsonb_agg(to_jsonb(u) order by id) from auth.users as u),
    'ledger', (select coalesce(jsonb_agg(to_jsonb(e) order by user_id), '[]'::jsonb) from private.demo_enrollments as e),
    'config', (select jsonb_agg(to_jsonb(c)) from private.demo_registration_config as c));`));
}

try {
  if (process.argv.length !== 2) throw new Error('This isolated runner accepts no server or other arguments.');
  for (const command of ['initdb', 'pg_ctl', 'psql']) {
    const { stdout } = await run(command, ['--version']);
    assert.match(stdout, /\b17\./, `${command} must use PostgreSQL 17`);
  }
  scratch = await mkdtemp('/tmp/supplyloop-reset-');
  await run('initdb', ['-D', `${scratch}/data`, '--username', 'postgres', '--auth=trust', '--no-locale', '--encoding=UTF8']);
  await run('pg_ctl', ['-D', `${scratch}/data`, '-l', `${scratch}/server.log`, '-o', `-F -c listen_addresses='' -k ${scratch} -p 55434`, '-w', 'start']);
  started = true;
  await sql(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, created_at timestamptz, raw_app_meta_data jsonb not null default '{}'::jsonb, deleted_at timestamptz,
      encrypted_password text, email_confirmed_at timestamptz, is_anonymous boolean not null default false);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;$$;
    insert into auth.users (id,email,created_at,raw_app_meta_data,encrypted_password,email_confirmed_at)
      select id,email,created_at,app_metadata,'unchanged-fictional-password-hash',created_at from jsonb_to_recordset(${literal(users)}) as u(id uuid,email text,created_at timestamptz,app_metadata jsonb);`);
  for (const migration of ['20261018000100_supplyloop_core.sql', '20261018000200_student_only_recipients.sql', '20261018000300_demo_registration.sql']) {
    await run('psql', [...psqlArgs(), '-f', `supabase/migrations/${migration}`]);
  }
  await sql(`insert into public.schools (id,name,slug,enabled_categories,pickup_label,term_label,created_at)
      select id,name,slug,enabled_categories,pickup_label,term_label,'${stamp}'::timestamptz from jsonb_populate_recordset(null::public.schools,${literal(schools)});
    insert into public.memberships select * from jsonb_populate_recordset(null::public.memberships,${literal(memberships)});
    insert into private.demo_registration_config(singleton,school_id,code_digest,enabled) values(true,'${schools[0].id}',sha256('unchanged-fictional-code'::bytea),true);
    insert into private.demo_enrollments(user_id,school_id,created_at) select user_id,school_id,created_at from public.memberships where user_id::text like 'bbbbbbbb%';
    insert into public.items(id,school_id,item_code,category,status,title,condition,garment_type,size_system,size_label,color_variant,approved_at,available_at)
      values ('cccccccc-0000-4000-8000-000000000001','${schools[0].id}','RESET-RESERVED','clothing','reserved','Test shirt','good','shirt','letter','M','Green','${stamp}','${stamp}'),
      ('cccccccc-0000-4000-8000-000000000002','${schools[0].id}','RESET-TRANSFERRED','clothing','transferred','Test sweater','good','sweater','letter','S','Navy','${stamp}','${stamp}');
    insert into public.items(id,school_id,item_code,category) values('cccccccc-0000-4000-8000-000000000003','${schools[1].id}','RESET-INTAKE','clothing');
    insert into public.item_staff(school_id,item_id,received_by) select school_id,id,'${users[0].id}' from public.items where school_id='${schools[0].id}';
    insert into public.reservations(id,school_id,item_id,member_id,status,completed_at,completed_by) values
      ('dddddddd-0000-4000-8000-000000000001','${schools[0].id}','cccccccc-0000-4000-8000-000000000001','${users[6].id}','active',null,null),
      ('dddddddd-0000-4000-8000-000000000002','${schools[0].id}','cccccccc-0000-4000-8000-000000000002','${users[7].id}','completed','${stamp}','${users[0].id}');
    insert into public.item_events(school_id,item_id,reservation_id,action,actor_id) select school_id,item_id,id,'reserved',member_id from public.reservations;
    insert into public.item_events(school_id,item_id,reservation_id,action,actor_id) select school_id,item_id,id,'pickup_completed',completed_by from public.reservations where status='completed';`);
  const plan = buildPlan(users, await snapshot());
  const cleanup = renderCleanupSql(plan);
  const cleanupFile = `${scratch}/cleanup.sql`;
  await writeFile(cleanupFile, cleanup, { mode: 0o600, flag: 'wx' });

  async function refused(mutate, restore) {
    await sql(mutate);
    const before = await completeState();
    await assert.rejects(run('psql', [...psqlArgs(), '-f', cleanupFile]));
    assert.deepEqual(await completeState(), before, 'A refused reset must leave every record untouched');
    await sql(restore);
    checks += 1;
  }
  await refused("insert into public.schools(id,name,slug,pickup_label,term_label) values('eeeeeeee-0000-4000-8000-000000000001','Unexpected','unexpected','Desk','Term');", "delete from public.schools where slug='unexpected';");
  await refused("insert into auth.users(id,email,created_at) values('eeeeeeee-0000-4000-8000-000000000002','later@supplyloop.example',now());", "delete from auth.users where id='eeeeeeee-0000-4000-8000-000000000002';");
  await refused("update public.items set id='eeeeeeee-0000-4000-8000-000000000003' where item_code='RESET-INTAKE';", "update public.items set id='cccccccc-0000-4000-8000-000000000003' where item_code='RESET-INTAKE';");
  await refused(`update public.memberships set display_label='Changed' where user_id='${users[6].id}';`, `update public.memberships set display_label=${literal(memberships[6].display_label)} #>> '{}' where user_id='${users[6].id}';`);
  await refused(`update private.demo_enrollments set created_at=created_at + interval '1 second' where user_id='${users[6].id}';`, `update private.demo_enrollments set created_at='${stamp}' where user_id='${users[6].id}';`);
  await refused(`update auth.users set raw_app_meta_data='{}' where id='${users[0].id}';`, `update auth.users set raw_app_meta_data=${literal(users[0].app_metadata)} where id='${users[0].id}';`);
  await refused("create function private.reject_reset_fixture() returns trigger language plpgsql as $$begin raise exception 'Fixture failure after earlier deletes'; end;$$; create trigger reject_reset_fixture before delete on public.reservations for each row execute function private.reject_reset_fixture();", "drop trigger reject_reset_fixture on public.reservations; drop function private.reject_reset_fixture();");

  // Detail corrections do not change the explicitly authorized identity set.
  await sql("update public.items set title='Corrected before reset' where item_code='RESET-INTAKE';");
  const protectedBefore = await completeState();
  await run('psql', [...psqlArgs(), '-f', cleanupFile]);
  const after = await completeState();
  assert.deepEqual(after.auth, protectedBefore.auth, 'Auth identities/passwords must be unchanged');
  assert.deepEqual(after.config, protectedBefore.config, 'The private join-code config must be unchanged');
  assert.deepEqual(after.public.schools, protectedBefore.public.schools);
  assert.deepEqual(after.public.memberships, protectedBefore.public.memberships.filter(row => !plan.targetIds.includes(row.user_id)));
  for (const table of ['items', 'item_staff', 'reservations', 'item_events']) assert.equal(after.public[table].length, 0);
  assert.equal(after.ledger.length, 0);
  checks += 1;
  // The cleanup transaction is deliberately not replayable after its snapshot changed.
  await assert.rejects(run('psql', [...psqlArgs(), '-f', cleanupFile]));
  assert.deepEqual(await completeState(), after);
  checks += 1;
  console.log(`Reset regression passed: ${checks} isolated PostgreSQL 17 checks; fixed identities/passwords, school code, and six memberships preserved. No hosted requests or application credentials used.`);
} catch (error) {
  console.error('Isolated reset regression failed:', error.message);
  if (error.stderr) console.error(error.stderr);
  process.exitCode = 1;
} finally {
  if (started) {
    try { await run('pg_ctl', ['-D', `${scratch}/data`, '-m', 'fast', '-w', 'stop']); started = false; }
    catch { console.error('Could not stop the isolated reset fixture; review its temporary cluster.'); process.exitCode = 1; }
  }
  if (scratch && !started) await rm(scratch, { recursive: true, force: true });
}
