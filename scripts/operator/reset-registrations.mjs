// Explicit operator-only reset authorized October 24, 2026. Never import in the app.
// Docs checked 2026-10-24: Supabase JS 2.118.0 admin listUsers/deleteUser/select;
// PostgreSQL 17 constraints/transactions/JSON/locking; Node 22 fs flags/crypto.
// https://supabase.com/docs/reference/javascript/auth-admin-deleteuser
// https://supabase.com/docs/reference/javascript/auth-admin-listusers
// https://supabase.com/docs/reference/javascript/select
// https://www.postgresql.org/docs/17/ddl-constraints.html
// https://www.postgresql.org/docs/17/tutorial-transactions.html
// https://www.postgresql.org/docs/17/functions-json.html
// https://nodejs.org/docs/latest-v22.x/api/fs.html
// https://nodejs.org/docs/latest-v22.x/api/crypto.html
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { schools } from '../../supabase/fixtures.mjs';

export const projectRef = 'myyfdtqpeqbhnxwlpkeg';
const expectedOrigin = `https://${projectRef}.supabase.co`;
const root = new URL('../../', import.meta.url);
const manifestFile = new URL('.reset-registrations-manifest.local', root);
const sqlFile = new URL('.reset-registrations-cleanup.local', root);
const authOptions = { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const tableOrders = {
  schools: ['id'], memberships: ['school_id', 'user_id'], items: ['id'],
  item_staff: ['school_id', 'item_id'], reservations: ['id'], item_events: ['id'],
};
const inventoryTables = ['items', 'item_staff', 'reservations', 'item_events'];
const fixtures = schools.flatMap((school, index) => ['MANAGER', 'MEMBER1', 'MEMBER2'].map(suffix => ({
  school_id: school.id,
  key: `DEMO_${index === 0 ? 'A' : 'B'}_${suffix}`,
  email: `${school.slug}.${suffix.toLowerCase()}@supplyloop.example`,
  role: suffix === 'MANAGER' ? 'manager' : 'member',
  display_label: `${school.name} ${suffix === 'MANAGER' ? 'manager' : suffix === 'MEMBER1' ? 'member 1' : 'member 2'}`,
})));

class OperatorError extends Error {}
function fail(message) { throw new OperatorError(message); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function equal(a, b) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function checked(result, action) {
  if (result.error) {
    const code = String(result.error.code ?? result.error.status ?? 'REQUEST_FAILED');
    fail(`${action} failed (${/^[a-zA-Z0-9_]+$/.test(code) ? code : 'REQUEST_FAILED'}). No private values were printed.`);
  }
  return result.data;
}
function validateId(id) { if (typeof id !== 'string' || !uuidPattern.test(id)) fail('An account identifier is invalid; reset refused.'); }
function assertSchools(rows) {
  if (!Array.isArray(rows) || rows.length !== schools.length) fail('The school set differs from the two approved fictional schools.');
  for (const school of schools) {
    const row = rows.find(candidate => candidate.id === school.id);
    if (!row || Object.entries(school).some(([key, value]) => !equal(row[key], value))) fail('An approved fictional school differs from its fixture.');
  }
}
function fixedUsers(users) {
  if (!Array.isArray(users) || users.length > 10_000) fail('Unexpected Auth account list.');
  const ids = new Set();
  for (const user of users) {
    validateId(user.id);
    if (ids.has(user.id)) fail('Duplicate account identifiers; reset refused.');
    ids.add(user.id);
  }
  const keep = fixtures.map(fixture => {
    const matches = users.filter(user => user.email === fixture.email);
    if (matches.length !== 1) fail('A fixed account is missing or ambiguous; reset refused.');
    const user = matches[0];
    if (user.deleted_at || user.app_metadata?.supplyloop_demo_project !== projectRef || user.app_metadata?.fixture_key !== fixture.key) fail('A fixed account does not have the trusted fixture markers.');
    return { ...fixture, id: user.id };
  });
  for (const user of users) {
    if (keep.some(account => account.id === user.id)) continue;
    if (user.app_metadata?.fixture_key || user.app_metadata?.supplyloop_demo_project
      || fixtures.some(fixture => fixture.email === user.email?.toLowerCase())) fail('An unexpected account has reserved fixture markers; reset refused.');
  }
  return keep;
}
function assertFixedMemberships(rows, keep) {
  for (const fixture of keep) {
    const matches = rows.filter(row => row.user_id === fixture.id);
    if (matches.length !== 1) fail('A fixed account membership is missing or reassigned.');
    const row = matches[0];
    if (row.school_id !== fixture.school_id || row.role !== fixture.role || row.active !== true || row.display_label !== fixture.display_label) fail('A fixed account membership differs from its fixture.');
  }
}

export function buildPlan(users, snapshot, { id = randomUUID(), createdAt = new Date().toISOString() } = {}) {
  assertSchools(snapshot.schools);
  const keep = fixedUsers(users);
  assertFixedMemberships(snapshot.memberships, keep);
  const targetIds = users.filter(user => !keep.some(fixture => fixture.id === user.id)).map(user => user.id).sort();
  const allIds = new Set(users.map(user => user.id));
  for (const [table, rows] of Object.entries(snapshot)) {
    if (!Object.hasOwn(tableOrders, table) || !Array.isArray(rows)) fail('Unexpected public snapshot.');
    if (table !== 'schools' && rows.some(row => !schools.some(school => school.id === row.school_id))) fail('A dependency belongs to an unrecognized school.');
  }
  if (!equal(Object.keys(snapshot).sort(), Object.keys(tableOrders).sort())) fail('The public snapshot is incomplete.');
  for (const row of snapshot.memberships) {
    if (!allIds.has(row.user_id)) fail('A membership has an unknown account.');
    if (targetIds.includes(row.user_id) && (row.school_id !== schools[0].id || row.role !== 'member')) fail('An added account has an unexpected school or privileged role; reset refused.');
  }
  // The installed enrollment RPC records precisely the membership's created_at.
  // SQL must prove this expected ledger; no assumption is used to bypass a check.
  const enrollmentRows = snapshot.memberships.filter(row => targetIds.includes(row.user_id)).map(row => ({
    user_id: row.user_id, school_id: row.school_id, created_at: row.created_at,
  }));
  // Only object identity matters for the explicitly authorized stock reset.
  // Keep every membership/school field exact, but omit historical item content.
  const compactSnapshot = Object.fromEntries(Object.entries(snapshot).map(([table, rows]) => [table,
    inventoryTables.includes(table) ? rows.map(row => Object.fromEntries([...new Set(['school_id', ...tableOrders[table]])].map(key => [key, row[key]]))) : rows,
  ]));
  return {
    version: 1, id, projectRef, createdAt, keep, targetIds,
    authRows: users.map(user => ({ id: user.id, created_at: user.created_at })).sort((a, b) => a.id.localeCompare(b.id)),
    snapshot: compactSnapshot, enrollmentRows,
  };
}

function sqlLiteral(value) { return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`; }
function snapshotGuard(table, rows) {
  return `  if exists (
    (select * from ${table} except select * from pg_catalog.jsonb_populate_recordset(null::${table}, ${sqlLiteral(rows)}))
    union all
    (select * from pg_catalog.jsonb_populate_recordset(null::${table}, ${sqlLiteral(rows)}) except select * from ${table})
  ) then raise exception 'Planned ${table} records changed; reset refused.'; end if;`;
}
function inventoryGuard(table, rows) {
  const columns = tableOrders[table];
  const key = columns.map(column => `${column}::text`).join(" || ':' || ");
  const keys = rows.map(row => columns.map(column => row[column]).join(':')).sort();
  const hash = digest(keys.join(','));
  return `  if (select pg_catalog.count(*) from public.${table}) <> ${rows.length}
    or (select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(pg_catalog.string_agg(${key}, ',' order by (${key}) collate "C"), ''), 'UTF8')), 'hex') from public.${table}) <> '${hash}' then
    raise exception 'Planned public.${table} identity set changed; reset refused.';
  end if;`;
}

export function renderCleanupSql(plan) {
  const schoolsSql = schools.map(school => `'${school.id}'::uuid`).join(', ');
  const targetsSql = `select e.value::uuid from pg_catalog.jsonb_array_elements_text(${sqlLiteral(plan.targetIds)}) as e(value)`;
  let bodyTag;
  for (let suffix = 0; ; suffix += 1) {
    bodyTag = `$reset_${digest(JSON.stringify(plan)).slice(0, 24)}_${suffix}$`;
    if (!JSON.stringify(plan).includes(bodyTag)) break;
  }
  return `-- PRIVATE reviewed operator reset, plan ${plan.id}; project ${projectRef} only.
-- Deletes all fictional stock/history and added memberships; preserves Auth,
-- six fixed memberships, schools, and the existing private school join code.
-- Apply this complete transaction once in the verified project's SQL Editor.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path = '';
set local standard_conforming_strings = on;
do $operator$
begin
  if current_user <> 'postgres' then raise exception 'Trusted postgres operator required.'; end if;
end;
$operator$;
lock table auth.users in share mode;
lock table public.schools, public.memberships, public.items, public.item_staff,
  public.reservations, public.item_events, private.demo_enrollments,
  private.demo_registration_config in access exclusive mode;
do ${bodyTag}
declare
  v_config jsonb;
  v_fixed_auth jsonb;
begin
  -- Exact UUID/creation set prevents a new registration or removal after planning.
  if exists (
    (select u.id, u.created_at from auth.users as u except select e.id, e.created_at from pg_catalog.jsonb_to_recordset(${sqlLiteral(plan.authRows)}) as e(id uuid, created_at timestamptz))
    union all
    (select e.id, e.created_at from pg_catalog.jsonb_to_recordset(${sqlLiteral(plan.authRows)}) as e(id uuid, created_at timestamptz) except select u.id, u.created_at from auth.users as u)
  ) then raise exception 'Planned Auth account set changed; reset refused.'; end if;
  if (select pg_catalog.count(*) from auth.users as u join pg_catalog.jsonb_to_recordset(${sqlLiteral(plan.keep)}) as f(id uuid, email text, key text)
    on u.id = f.id and u.email = f.email and u.deleted_at is null
      and u.raw_app_meta_data ->> 'supplyloop_demo_project' = '${projectRef}'
      and u.raw_app_meta_data ->> 'fixture_key' = f.key) <> 6 then
    raise exception 'Fixed Auth identity or trusted markers changed; reset refused.';
  end if;
  if exists (select 1 from auth.users as u where u.id in (${targetsSql})
    and (u.raw_app_meta_data ? 'fixture_key' or u.raw_app_meta_data ? 'supplyloop_demo_project')) then
    raise exception 'A target has reserved fixture markers; reset refused.';
  end if;
${Object.entries(plan.snapshot).map(([table, rows]) => inventoryTables.includes(table) ? inventoryGuard(table, rows) : snapshotGuard(`public.${table}`, rows)).join('\n')}
${snapshotGuard('private.demo_enrollments', plan.enrollmentRows)}
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c)), '[]'::jsonb) into v_config from private.demo_registration_config as c;
  select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(u) order by u.id) into v_fixed_auth from auth.users as u
    where u.id not in (${targetsSql});

  delete from public.item_events where school_id in (${schoolsSql});
  delete from public.reservations where school_id in (${schoolsSql});
  delete from public.item_staff where school_id in (${schoolsSql});
  delete from public.items where school_id in (${schoolsSql});
  delete from private.demo_enrollments where user_id in (${targetsSql});
  delete from public.memberships where school_id in (${schoolsSql}) and user_id in (${targetsSql});

${snapshotGuard('public.memberships', plan.snapshot.memberships.filter(row => plan.keep.some(fixture => fixture.id === row.user_id)))}
  if exists (select 1 from private.demo_enrollments)
    or exists (select 1 from public.items) or exists (select 1 from public.item_staff)
    or exists (select 1 from public.reservations) or exists (select 1 from public.item_events) then
    raise exception 'Cleanup postconditions failed; all changes rolled back.';
  end if;
  if v_config is distinct from (select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c)), '[]'::jsonb) from private.demo_registration_config as c)
    or v_fixed_auth is distinct from (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(u) order by u.id) from auth.users as u where u.id not in (${targetsSql})) then
    raise exception 'Protected records changed; all changes rolled back.';
  end if;
end;
${bodyTag};
commit;
select 'Cleanup committed; six fixed memberships retained. Run the frozen account deletion command before provisioning original stock.' as reset_status;
`;
}

async function readUsers(admin) {
  const users = [];
  for (let page = 1; page <= 100; page += 1) {
    const data = checked(await admin.auth.admin.listUsers({ page, perPage: 100 }), 'Read account list');
    users.push(...data.users);
    if (data.users.length < 100) return users;
  }
  fail('Too many accounts for this bounded fictional reset.');
}
async function readSnapshot(admin) {
  const snapshot = {};
  for (const [table, order] of Object.entries(tableOrders)) {
    const rows = [];
    let total;
    for (let offset = 0; offset <= 10_000; offset += 200) {
      let query = admin.from(table).select('*', { count: 'exact' });
      for (const column of order) query = query.order(column, { ascending: true });
      const result = await query.range(offset, offset + 199);
      const data = checked(result, `Read ${table}`);
      if (!Number.isInteger(result.count) || result.count > 10_000 || (total !== undefined && total !== result.count)) fail(`The ${table} record count is unavailable, excessive, or changed during planning.`);
      total = result.count;
      rows.push(...data);
      if (rows.length === total) break;
      if (data.length === 0 || rows.length > total) fail(`The ${table} snapshot is incomplete.`);
    }
    snapshot[table] = rows;
  }
  return snapshot;
}

export function assertPostCleanup(plan, users, snapshot) {
  const liveKeep = fixedUsers(users);
  if (!equal(liveKeep, plan.keep)) fail('The protected account set changed after planning.');
  const plannedAuth = new Map(plan.authRows.map(row => [row.id, row.created_at]));
  if (users.some(user => !plannedAuth.has(user.id) || plannedAuth.get(user.id) !== user.created_at)) fail('The Auth target set changed; no further accounts will be deleted.');
  assertSchools(snapshot.schools);
  if (!equal(snapshot.schools, plan.snapshot.schools)) fail('School records changed after planning.');
  const expectedMemberships = plan.snapshot.memberships.filter(row => plan.keep.some(fixture => fixture.id === row.user_id));
  if (!equal(snapshot.memberships, expectedMemberships)) fail('Apply the reviewed cleanup SQL first; only the six unchanged fixed memberships may remain.');
  if (inventoryTables.some(table => snapshot[table]?.length !== 0)) fail('Apply the reviewed cleanup SQL first; inventory and pickup history must be empty before account deletion.');
  return users.filter(user => plan.targetIds.includes(user.id));
}

async function readPrivate(file) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || (info.mode & 0o077) !== 0 || info.uid !== process.getuid()) fail('Reset artifacts must be owner-only regular files.');
    return await handle.readFile('utf8');
  } finally { await handle.close(); }
}
async function writePrivate(file, value) {
  const handle = await open(file, 'wx', 0o600);
  try { await handle.writeFile(value, 'utf8'); } finally { await handle.close(); }
}
export function validateManifest(manifest, sql) {
  if (!manifest || manifest.version !== 1 || manifest.projectRef !== projectRef || !uuidPattern.test(manifest.id)
    || !Array.isArray(manifest.targetIds) || !Array.isArray(manifest.authRows)) fail('The frozen reset manifest is invalid.');
  manifest.targetIds.forEach(validateId);
  const reconstructedUsers = manifest.authRows.map(row => {
    validateId(row.id);
    const fixture = manifest.keep?.find(account => account.id === row.id);
    return { ...row, ...(fixture ? { email: fixture.email, app_metadata: { supplyloop_demo_project: projectRef, fixture_key: fixture.key } } : {}) };
  });
  const rebuilt = buildPlan(reconstructedUsers, manifest.snapshot, { id: manifest.id, createdAt: manifest.createdAt });
  const { sqlSha256, ...payload } = manifest;
  if (!equal(rebuilt, payload) || sqlSha256 !== digest(sql) || renderCleanupSql(rebuilt) !== sql) fail('The frozen manifest or SQL changed; deletion refused.');
  return rebuilt;
}

export async function deleteAccounts(admin, plan, log = console.log) {
  let removed = 0;
  let alreadyAbsent = 0;
  // Rechecking before each frozen UUID limits races and makes interruption safe.
  for (const id of plan.targetIds) {
    const users = await readUsers(admin);
    assertPostCleanup(plan, users, await readSnapshot(admin));
    if (!users.some(user => user.id === id)) { alreadyAbsent += 1; continue; }
    checked(await admin.auth.admin.deleteUser(id, false), 'Delete planned added account');
    removed += 1;
    log(`Deleted ${removed} planned added account(s); fixed accounts preserved.`);
  }
  const remaining = assertPostCleanup(plan, await readUsers(admin), await readSnapshot(admin));
  if (remaining.length !== 0) fail('Planned account deletion is incomplete; retry the same frozen manifest.');
  log(`Account reset complete: ${removed} removed this run, ${alreadyAbsent} already absent, six fixed accounts preserved. Run npm run demo:provision to recreate the original 11 stock fixtures.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--plan', '--delete-accounts'].includes(args[0])) fail('Use --plan for a read-only backend snapshot, or --delete-accounts only after applying its reviewed cleanup SQL.');
  const rawUrl = process.env.SUPABASE_URL?.trim();
  let url;
  try { url = new URL(rawUrl); } catch { fail('Configure the approved project URL in the private operator environment.'); }
  if (url.origin !== expectedOrigin || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) fail('This reset is restricted to the approved SupplyLoop project.');
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secret) fail('Configure the server-only operator key privately; no browser key can perform this reset.');
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(expectedOrigin, secret, { auth: authOptions });
  if (args[0] === '--plan') {
    const plan = buildPlan(await readUsers(admin), await readSnapshot(admin));
    const sql = renderCleanupSql(plan);
    await writePrivate(manifestFile, `${JSON.stringify({ ...plan, sqlSha256: digest(sql) }, null, 2)}\n`);
    try { await writePrivate(sqlFile, sql); }
    catch (error) { await unlink(manifestFile); throw error; }
    console.log(`Read-only plan prepared: ${plan.targetIds.length} added accounts; six fixed accounts retained; ${plan.snapshot.items.length} items, ${plan.snapshot.reservations.length} reservations, ${plan.snapshot.item_events.length} events scheduled for fictional-data reset.`);
    console.log('Owner-only .reset-registrations-manifest.local and .reset-registrations-cleanup.local created. No hosted changes made. Review and apply the complete SQL in the approved project, then run the same script with --delete-accounts before provisioning.');
    return;
  }
  const plan = validateManifest(JSON.parse(await readPrivate(manifestFile)), await readPrivate(sqlFile));
  await deleteAccounts(admin, plan);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { await main(); }
  catch (error) {
    console.error(error instanceof OperatorError ? error.message : 'Reset stopped. No private values printed. Inspect local artifact permissions/configuration; an interrupted account deletion can resume with the same manifest.');
    process.exitCode = 1;
  }
}
