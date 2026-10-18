// Offline operator tooling. Never import into frontend code.
// Node 22.20 crypto/fs documentation checked 2026-10-18.
import { createHash, randomBytes } from 'node:crypto';
import { lstat, writeFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const credentialFile = new URL('.env.registration.local', root);
const sqlFile = new URL('.registration-setup.local', root);

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check') || args.length > 1) throw new Error('Unsupported option.');
  if (args.includes('--check')) {
    console.log('Registration plan: one private code; School A students only; no automatic expiry/capacity. No files, network, or account changes.');
    return;
  }
  for (const file of [credentialFile, sqlFile]) {
    try { await lstat(file); throw new Error('Registration output already exists; no code was rotated or overwritten.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const code = `SL-${randomBytes(32).toString('base64url')}`;
  const digest = createHash('sha256').update(code, 'utf8').digest('hex');
  const sql = `-- PRIVATE OPERATOR PREPARATION. Verify project myyfdtqpeqbhnxwlpkeg (supplyloop-demo).
-- Apply only after reviewed migration 20261018000300. Contains a digest, not the raw code.
begin;
set local lock_timeout = '5s';
do $guard$ begin
  if not exists (select 1 from public.schools where id = '11111111-1111-1111-1111-111111111111'::uuid and slug = 'school-a' and name = 'School A') then
    raise exception 'Approved fictional school missing; registration setup refused.';
  end if;
end; $guard$;
insert into private.demo_registration_config (singleton, school_id, code_digest, enabled)
values (true, '11111111-1111-1111-1111-111111111111', pg_catalog.decode('${digest}', 'hex'), true)
on conflict (singleton) do update set code_digest = excluded.code_digest, enabled = true, updated_at = pg_catalog.clock_timestamp();
commit;
`;
  await writeFile(credentialFile, `# Private demo enrollment code. Never commit, publish, or place in Auth metadata.\nDEMO_REGISTRATION_ACCESS_CODE=${JSON.stringify(code)}\n`, { encoding:'utf8', mode:0o600, flag:'wx' });
  await writeFile(sqlFile, sql, { encoding:'utf8', mode:0o600, flag:'wx' });
  console.log('Prepared owner-only .env.registration.local and .registration-setup.local. No backend changes; no code printed.');
}

try { await main(); }
catch (error) {
  console.error(error.code ? 'Registration preparation failed; inspect output-file permissions/existence. No code was printed.' : error.message);
  process.exitCode = 1;
}
