// Isolated PostgreSQL 17 regression only. Never reads application credentials or
// connects to a supplied server. Requires initdb, pg_ctl and psql on PATH.
// Official Node 22.20 child_process/fs and PG17 initdb/pg_ctl docs read 2026-10-23.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const runFile = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const localEnv = { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C', TZ: 'UTC' };
const admin = 'supplyloop_fixture_admin';
const port = '55432';
let scratch;
let started = false;

async function run(command, args) {
  return runFile(command, args, { cwd: root, env: localEnv, timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
}
function psqlArgs(user = admin) {
  return ['-X', '--no-password', '-v', 'ON_ERROR_STOP=1', '-qAt', '-h', scratch, '-p', port, '-U', user, '-d', 'postgres'];
}

try {
  if (process.argv.length !== 2) throw new Error('This runner accepts no server, environment file, or other arguments.');
  for (const command of ['initdb', 'pg_ctl', 'psql']) {
    const { stdout } = await run(command, ['--version']);
    if (!/\b17\./.test(stdout)) throw new Error(`${command} must use PostgreSQL 17.`);
  }
  scratch = await mkdtemp('/tmp/supplyloop-email-');
  await run('initdb', ['-D', `${scratch}/data`, '--username', admin, '--auth=trust', '--no-locale', '--encoding=UTF8']);
  // Unique owner-only Unix socket directory; no TCP listener or existing server.
  await run('pg_ctl', ['-D', `${scratch}/data`, '-l', `${scratch}/server.log`, '-o', `-F -c listen_addresses='' -k ${scratch} -p ${port} -c supplyloop.fixture=email-enrollment-v1`, '-w', 'start']);
  started = true;
  await run('psql', [...psqlArgs(), '-f', 'supabase/tests/email-enrollment-bootstrap.sql']);
  for (const migration of ['20261018000100_supplyloop_core.sql', '20261018000200_student_only_recipients.sql', '20261018000300_demo_registration.sql']) {
    await run('psql', [...psqlArgs('postgres'), '-f', `supabase/migrations/${migration}`]);
  }
  const { stdout } = await run('psql', [...psqlArgs(), '-f', 'supabase/tests/email-enrollment.sql']);
  assert.match(stdout, /Email enrollment SQL regression passed/);

  // Both callers use the same ordinary actor and contend on its enrollment lock.
  const raceSql = `begin;
set local role authenticated;
select fixture.set_context(fixture.claims('bbbbbbbb-0000-4000-8000-000000000008', 'race@supplyloop.example', 'otp')::text);
select row_to_json(j)::text from public.join_demo_school('isolated-fixture-code', 'Concurrent student') as j;
commit;`;
  const racers = await Promise.all([run('psql', [...psqlArgs(), '-c', raceSql]), run('psql', [...psqlArgs(), '-c', raceSql])]);
  const memberships = racers.map(({ stdout: output }) => JSON.parse(output.split('\n').find(line => line.startsWith('{'))));
  assert.deepEqual(memberships[0], memberships[1]);
  const { stdout: raceCount } = await run('psql', [...psqlArgs(), '-c', "select count(*) from private.demo_enrollments where user_id='bbbbbbbb-0000-4000-8000-000000000008';"]);
  assert.equal(raceCount.trim(), '1');
  console.log('Email enrollment SQL regression passed on isolated PostgreSQL 17; concurrent enrollment returned one unchanged membership. No hosted requests or data changes.');
} catch (error) {
  console.error('Isolated email enrollment regression failed:', error.message);
  if (error.stderr) console.error(error.stderr);
  process.exitCode = 1;
} finally {
  if (started) {
    try { await run('pg_ctl', ['-D', `${scratch}/data`, '-m', 'fast', '-w', 'stop']); }
    catch { console.error('Could not stop the isolated test cluster. Review the temporary cluster before cleanup.'); process.exitCode = 1; started = true; }
    // A successful shutdown permits removal of this runner's own scratch folder.
    try { await run('pg_ctl', ['-D', `${scratch}/data`, 'status']); }
    catch (error) { if (error.code === 3) started = false; }
  }
  if (scratch && !started) await rm(scratch, { recursive: true, force: true });
}
