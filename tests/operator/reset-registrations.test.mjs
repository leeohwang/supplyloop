import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { schools } from '../../supabase/fixtures.mjs';
import { buildPlan, renderCleanupSql, validateManifest, assertPostCleanup, deleteAccounts, projectRef } from '../../scripts/operator/reset-registrations.mjs';

const stamp = '2026-10-24T00:00:00.000Z';
const id = n => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
function fixture() {
  const users = [];
  const memberships = [];
  schools.forEach((school, schoolIndex) => ['MANAGER', 'MEMBER1', 'MEMBER2'].forEach((suffix, accountIndex) => {
    const key = `DEMO_${schoolIndex ? 'B' : 'A'}_${suffix}`;
    const user = { id: id(schoolIndex * 3 + accountIndex + 1), email: `${school.slug}.${suffix.toLowerCase()}@supplyloop.example`, created_at: stamp,
      app_metadata: { supplyloop_demo_project: projectRef, fixture_key: key } };
    users.push(user);
    memberships.push({ school_id: school.id, user_id: user.id, role: suffix === 'MANAGER' ? 'manager' : 'member', active: true,
      display_label: `${school.name} ${suffix === 'MANAGER' ? 'manager' : suffix === 'MEMBER1' ? 'member 1' : 'member 2'}`, created_at: stamp });
  }));
  users.push(...[7, 8].map(n => ({ id: id(n), email: `self${n}@fixture.invalid`, app_metadata: {}, created_at: stamp })));
  memberships.push({ school_id: schools[0].id, user_id: id(7), role: 'member', active: true, display_label: 'Fictional member', created_at: stamp });
  const snapshot = { schools: structuredClone(schools), memberships, items: [], item_staff: [], reservations: [], item_events: [] };
  const plan = buildPlan(users, snapshot);
  const clean = { ...structuredClone(snapshot), memberships: snapshot.memberships.filter(row => row.user_id !== id(7)) };
  return { users, snapshot, plan, clean };
}

test('only two additional accounts are targeted and private configuration is never deleted', () => {
  const { plan } = fixture();
  assert.deepEqual(plan.targetIds, [id(7), id(8)]);
  assert.equal(plan.keep.length, 6);
  const sql = renderCleanupSql(plan);
  assert.match(sql, /begin;/);
  assert.match(sql, /lock table auth.users in share mode/);
  assert.doesNotMatch(sql, /delete from auth\.users|delete from private\.demo_registration_config|update auth\.users|truncate/i);
  const sqlTables = [...sql.matchAll(/delete from ([a-z_.]+)/gi)].map(match => match[1]);
  assert.deepEqual(sqlTables, ['public.item_events', 'public.reservations', 'public.item_staff', 'public.items', 'private.demo_enrollments', 'public.memberships']);
});

test('missing, impersonated or reassigned protected fixture accounts abort the plan', () => {
  for (const change of [
    env => env.users.shift(),
    env => { env.users[0].app_metadata.fixture_key = 'DEMO_A_MEMBER1'; },
    env => { env.snapshot.memberships[0].role = 'member'; },
    env => { env.snapshot.memberships[0].school_id = schools[1].id; },
    env => { env.users[6].app_metadata.fixture_key = 'unrecognized'; },
    env => { env.snapshot.memberships.at(-1).role = 'manager'; },
    env => { env.snapshot.memberships.at(-1).school_id = schools[1].id; },
  ]) {
    const env = fixture(); change(env);
    assert.throws(() => buildPlan(env.users, env.snapshot));
  }
});

test('manifest roundtrip accepts exact frozen plan and rejects changed SQL or target list', () => {
  const { plan } = fixture();
  const sql = renderCleanupSql(plan);
  const manifest = { ...plan, sqlSha256: createHash('sha256').update(sql).digest('hex') };
  assert.deepEqual(validateManifest(JSON.parse(JSON.stringify(manifest)), sql), plan);
  assert.throws(() => validateManifest(manifest, `${sql}\n`));
  const tampered = structuredClone(manifest); tampered.targetIds.push(id(1));
  assert.throws(() => validateManifest(tampered, sql));
});

test('deletion preflight rejects stock, membership drift and a new account', () => {
  const { plan, users, clean } = fixture();
  assert.equal(assertPostCleanup(plan, users, clean).length, 2);
  assert.throws(() => assertPostCleanup(plan, users, { ...clean, items: [{ school_id: schools[0].id, id: id(9) }] }));
  const drift = structuredClone(clean); drift.memberships[0].display_label = 'changed';
  assert.throws(() => assertPostCleanup(plan, users, drift));
  assert.throws(() => assertPostCleanup(plan, [...users, { id: id(9), created_at: stamp }], clean));
});

function fakeAdmin(initial, snapshot, onDelete = () => {}) {
  let users = structuredClone(initial);
  const deleted = [];
  const admin = {
    auth: { admin: {
      listUsers: async ({ page, perPage }) => ({ data: { users: users.slice((page - 1) * perPage, page * perPage) }, error: null }),
      deleteUser: async (target, soft) => { assert.equal(soft, false); deleted.push(target); users = users.filter(user => user.id !== target); onDelete(users); return { data: { user: null }, error: null }; },
    } },
    from: table => {
      const query = { select() { return query; }, order() { return query; },
        range: async (start, end) => ({ data: snapshot[table].slice(start, end + 1), count: snapshot[table].length, error: null }) };
      return query;
    },
  };
  return { admin, deleted };
}

test('hard deletion affects only frozen extra UUIDs and repeat invocation does no writes', async () => {
  const { plan, users, clean } = fixture();
  const env = fakeAdmin(users, clean);
  await deleteAccounts(env.admin, plan, () => {});
  assert.deepEqual(env.deleted, [id(7), id(8)]);
  await deleteAccounts(env.admin, plan, () => {});
  assert.deepEqual(env.deleted, [id(7), id(8)]);
});

test('a new registration between deletes halts before another deletion', async () => {
  const { plan, users, clean } = fixture();
  const env = fakeAdmin(users, clean, remaining => { remaining.push({ id: id(9), created_at: stamp, app_metadata: {} }); });
  await assert.rejects(deleteAccounts(env.admin, plan, () => {}));
  assert.deepEqual(env.deleted, [id(7)]);
});
