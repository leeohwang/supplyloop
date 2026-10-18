// Operator-only fictional demo setup. Never import into frontend code.
// Supabase admin/createUser/listUsers, JS client/RPC/insert docs and Node 22.20
// crypto/fs/util docs retrieved 2026-10-18. No secret values are logged.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { chmod, lstat, readFile, rename, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { schools, inventory } from '../../supabase/fixtures.mjs';

const expectedHost = 'myyfdtqpeqbhnxwlpkeg.supabase.co';
const projectRef = 'myyfdtqpeqbhnxwlpkeg';
const root = new URL('../../', import.meta.url);
const output = new URL('.env.test.local', root);
const authOptions = { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false };
const accounts = schools.flatMap((school, index) => ['MANAGER', 'MEMBER1', 'MEMBER2'].map((suffix) => ({
  school,
  key: `DEMO_${index === 0 ? 'A' : 'B'}_${suffix}`,
  email: `${school.slug}.${suffix.toLowerCase()}@supplyloop.example`,
  role: suffix === 'MANAGER' ? 'manager' : 'member',
  label: `${school.name} ${suffix === 'MANAGER' ? 'manager' : suffix === 'MEMBER1' ? 'member 1' : 'member 2'}`,
})));

class OperatorError extends Error {}
function fail(message) { throw new OperatorError(message); }
function checked(result, action) {
  if (result.error) {
    const code = String(result.error.code ?? result.error.status ?? 'REQUEST_FAILED');
    fail(`${action} failed (${/^[a-zA-Z0-9_]+$/.test(code) ? code : 'REQUEST_FAILED'}). No credentials were printed.`);
  }
  return result.data;
}

async function saveCredentials(values, exists) {
  if (exists) {
    const info = await lstat(output);
    if (!info.isFile() || info.isSymbolicLink()) fail('The credential output must be a regular local file.');
  }
  const content = '# Fictional demo account credentials. Private local file; never commit or publish.\n'
    + Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n';
  const temporary = new URL('.env.test.local.tmp', root);
  await writeFile(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  await rename(temporary, output);
  await chmod(output, 0o600);
}

async function credentials(url, publishableKey, users) {
  let saved = {};
  let exists = false;
  try {
    const info = await lstat(output);
    if (!info.isFile() || info.isSymbolicLink()) fail('The credential output must be a regular local file.');
    saved = parseEnv(await readFile(output, 'utf8'));
    exists = true;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (saved.SUPABASE_URL && saved.SUPABASE_URL !== url) fail('Existing test credentials belong to another project.');
  if (saved.SUPABASE_SECRET_KEY) fail('Remove the privileged secret from the test credential file before proceeding.');
  const values = { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: publishableKey };
  for (const account of accounts) {
    const emailKey = `${account.key}_EMAIL`;
    if (saved[emailKey] && saved[emailKey] !== account.email) fail('Existing demo account labels differ from the versioned fixtures.');
    if (!saved[`${account.key}_PASSWORD`] && users.some((user) => user.email?.toLowerCase() === account.email)) fail('An existing demo account requires its original .env.test.local credentials; no password was reset.');
    values[emailKey] = account.email;
    values[`${account.key}_PASSWORD`] = saved[`${account.key}_PASSWORD`] || `Aa1!${randomBytes(24).toString('base64url')}`;
  }
  // Save before creating users, so an interrupted setup does not lose passwords.
  await saveCredentials(values, exists);
  return values;
}

async function ensureSchools(admin) {
  const existing = checked(await admin.from('schools').select('id,name,slug,enabled_categories,pickup_label,term_label'), 'Read demo schools');
  if (existing.some((row) => !schools.some((school) => school.id === row.id))) fail('Refusing to seed a project containing unrecognized schools.');
  for (const school of schools) {
    const row = existing.find((candidate) => candidate.id === school.id);
    if (row) {
      if (Object.entries(school).some(([key, value]) => JSON.stringify(row[key]) !== JSON.stringify(value))) fail('Existing school configuration differs from the approved fictional fixtures.');
    } else checked(await admin.from('schools').insert(school), 'Create fictional school');
  }
}

async function existingUsers(admin) {
  const users = [];
  for (let page = 1; page <= 100; page += 1) {
    const data = checked(await admin.auth.admin.listUsers({ page, perPage: 100 }), 'Read operator account list');
    users.push(...data.users);
    if (data.users.length < 100) return users;
  }
  fail('The dedicated demo has too many users for this provisioning script.');
}

async function ensureAccounts(admin, users, values, url, publishableKey, sessions) {
  for (const account of accounts) {
    let user = users.find((candidate) => candidate.email?.toLowerCase() === account.email);
    if (user && (user.app_metadata?.supplyloop_demo_project !== projectRef || user.app_metadata?.fixture_key !== account.key)) fail('An existing account conflicts with a fictional fixture; no account was overwritten.');
    if (!user) {
      const data = checked(await admin.auth.admin.createUser({
        email: account.email,
        password: values[`${account.key}_PASSWORD`],
        email_confirm: true,
        app_metadata: { supplyloop_demo_project: projectRef, fixture_key: account.key },
      }), 'Create confirmed fictional account');
      user = data.user;
      if (!user) fail('Account creation returned no user.');
    }
    account.userId = user.id;
    const rows = checked(await admin.from('memberships').select('school_id,user_id,role,active,display_label').eq('school_id', account.school.id).eq('user_id', user.id), 'Read fictional membership');
    const desired = { school_id: account.school.id, user_id: user.id, role: account.role, active: true, display_label: account.label };
    if (rows.length) {
      if (Object.entries(desired).some(([key, value]) => rows[0][key] !== value)) fail('An existing fictional membership differs from its fixture; no role was overwritten.');
    } else checked(await admin.from('memberships').insert(desired), 'Create fictional membership');
    const client = createClient(url, publishableKey, { auth: authOptions });
    checked(await client.auth.signInWithPassword({ email: account.email, password: values[`${account.key}_PASSWORD`] }), 'Verify fictional account sign-in');
    sessions.set(account.key, client);
  }
}

async function ensureInventory(sessions) {
  for (const fixture of inventory) {
    const school = schools.find((candidate) => candidate.slug === fixture.school);
    const manager = accounts.find((account) => account.school.id === school.id && account.role === 'manager');
    const client = sessions.get(manager.key);
    const existing = checked(await client.from('items').select('*').eq('school_id', school.id).eq('category', fixture.category).eq('title', fixture.details.title), 'Read existing fixture inventory');
    if (existing.length > 1) fail('Duplicate fixture inventory needs operator review; no records were reset.');
    let item = existing[0];
    if (item) {
      if (Object.entries(fixture.details).some(([key, value]) => item[key] !== value)) fail('A fixture was edited during the demo; use an explicit restoration rather than overwriting it.');
      // Preserve reservations, transfers, retirement, and history on ordinary reruns.
      if (item.status !== 'intake' || fixture.status === 'intake') continue;
      const staff = checked(await client.from('item_staff').select('received_by').eq('school_id', school.id).eq('item_id', item.id).single(), 'Check fixture receipt');
      if (staff.received_by !== manager.userId) fail('Existing inventory was received by a different operator; no item was modified.');
    } else {
      const result = checked(await client.rpc('intake_item', { p_school_id: school.id, p_category: fixture.category, p_details: fixture.details, p_storage_code: fixture.storage }).single(), 'Receive fictional inventory');
      item = { id: result.item_id };
    }
    if (fixture.status === 'available') checked(await client.rpc('publish_item', { p_item_id: item.id, p_inspection_confirmed: true }).single(), 'Publish inspected fictional inventory');
    else if (fixture.status === 'retired') checked(await client.rpc('retire_item', { p_item_id: item.id, p_reason: 'damaged' }).single(), 'Retire damaged fictional inventory');
  }
}

async function main() {
  const checkOnly = process.argv.slice(2).includes('--check');
  if (process.argv.slice(2).some((arg) => arg !== '--check')) fail('Unsupported operator option.');
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !publishableKey) fail('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the private operator environment file.');
  let url;
  try { url = new URL(rawUrl); } catch { fail('SUPABASE_URL must be the approved demo project URL.'); }
  if (url.protocol !== 'https:' || url.host !== expectedHost || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) fail('This script is restricted to the approved supplyloop-demo project.');
  if (checkOnly) {
    console.log(`Provisioning plan checked: ${schools.length} fictional schools, ${accounts.length} fixed-role accounts, ${inventory.length} physical-item fixtures. No changes made.`);
    return;
  }
  if (!secret) fail('Set SUPABASE_SECRET_KEY securely in .env.operator.local before provisioning.');
  const admin = createClient(url.origin, secret, { auth: authOptions });
  const users = await existingUsers(admin);
  const values = await credentials(url.origin, publishableKey, users);
  const sessions = new Map();
  try {
    await ensureSchools(admin);
    await ensureAccounts(admin, users, values, url.origin, publishableKey, sessions);
    await ensureInventory(sessions);
    console.log('Fictional demo provisioned. Private reviewer/test credentials are in .env.test.local (mode 0600). No credentials were printed.');
  } finally {
    await Promise.allSettled([...sessions.values()].map((client) => client.auth.signOut({ scope: 'local' })));
  }
}

try { await main(); } catch (error) {
  console.error(error instanceof OperatorError ? error.message : 'Operator setup failed. Credentials were not printed. Inspect the local environment and retry; existing demo accounts and transactions were not reset.');
  process.exitCode = 1;
}
