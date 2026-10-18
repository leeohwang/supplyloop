import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import {
  accountNames, DemoApi, expectFailure, expectHidden, expectPermissionFailure,
  mutation, readTestConfig, safeCode,
} from '../helpers/supabase.mjs'

// Explicit hosted acceptance: creates one retained fictional Auth account and
// school enrollment per run. No operator key, resets, or account deletion.
describe('SupplyLoop demo registration', { concurrency: false, timeout: 180_000 }, () => {
  let api
  let student
  let manager
  let schoolA
  let schoolB
  let code
  let original
  const fixed = []

  before(async () => {
    code = process.env.DEMO_REGISTRATION_ACCESS_CODE
    assert.ok(code, 'Load the private .env.registration.local enrollment code')
    api = new DemoApi(readTestConfig())
    manager = await api.login('A_MANAGER')
    schoolA = (await api.rows(manager, 'schools', { slug: 'eq.school-a' }))[0].id
    const other = await api.login('B_MANAGER')
    fixed.push(other)
    schoolB = (await api.rows(other, 'schools', { slug: 'eq.school-b' }))[0].id
    const response = await api.request(null, '/auth/v1/signup', {
      method: 'POST', body: {
        email: `registration-${randomUUID()}@supplyloop.example`,
        password: `Aa1!${randomBytes(24).toString('base64url')}`,
      },
    })
    assert.ok(response.ok, `Plain demo signup failed (${safeCode(response)}; HTTP ${response.status})`)
    assert.ok(typeof response.data?.access_token === 'string' && typeof response.data?.refresh_token === 'string' && typeof response.data?.user?.id === 'string', 'Demo signup must create a real immediate Auth session')
    student = { name: 'NEW_DEMO_STUDENT', userId: response.data.user.id, accessToken: response.data.access_token, refreshToken: response.data.refresh_token }
    assert.ok(!JSON.stringify(response.data.user).includes(code), 'Access code appeared in Auth signup data')
  })

  after(async () => {
    if (!api) return
    for (const actor of [student, manager, ...fixed].filter(Boolean)) {
      const result = await api.logout(actor)
      assert.ok(result.ok, `Registration test session cleanup failed (HTTP ${result.status})`)
    }
  })

  test('plain Auth signup grants no school access and private registration state is inaccessible', async () => {
    for (const table of ['schools', 'memberships', 'items', 'item_staff', 'reservations', 'item_events']) {
      expectHidden(await api.read(student, table), `New account before enrollment: ${table}`)
    }
    expectPermissionFailure(await api.rpc(null, 'join_demo_school', { p_access_code: code, p_display_label: 'Denied anonymous enrollment' }), 'Anonymous enrollment')
    for (const table of ['demo_registration_config', 'demo_enrollments']) {
      expectFailure(await api.request(student, `/rest/v1/${table}`, { headers: { 'Accept-Profile': 'private' } }), ['PGRST106'], `Private ${table}`)
    }
  })

  test('wrong code and blank label leave the authenticated account without membership', async () => {
    for (const supplied of [null, '', `incorrect-${randomUUID()}`]) {
      expectFailure(await api.rpc(student, 'join_demo_school', { p_access_code: supplied, p_display_label: 'New demo student' }), ['SL009'], 'Invalid enrollment code')
      assert.equal((await api.rows(student, 'memberships')).length, 0)
    }
    for (const label of [null, '', '   ', '\t\n']) {
      expectFailure(await api.rpc(student, 'join_demo_school', { p_access_code: code, p_display_label: label }), ['SL004'], 'Blank display name')
      assert.equal((await api.rows(student, 'memberships')).length, 0)
    }
    expectFailure(await api.rpc(student, 'join_demo_school', { p_access_code: code, p_display_label: 'Injected role', p_role: 'manager', p_school_id: schoolB }), ['PGRST202'], 'Enrollment accepts no role or school override')
    assert.equal((await api.rows(student, 'schools')).length, 0)
  })

  test('the six existing accounts cannot be re-enrolled or altered', async () => {
    for (const name of accountNames) {
      const actor = await api.login(name)
      fixed.push(actor)
      const beforeRows = await api.rows(actor, 'memberships', { user_id: `eq.${actor.userId}` })
      expectFailure(await api.rpc(actor, 'join_demo_school', { p_access_code: code, p_display_label: 'Must not replace existing membership' }), ['SL002'], `${name} preexisting enrollment`)
      const afterRows = await api.rows(actor, 'memberships', { user_id: `eq.${actor.userId}` })
      assert.deepEqual(afterRows, beforeRows, 'Existing membership changed')
    }
  })

  test('metadata cannot choose school/role; concurrent enrollment creates one idempotent School A student', async () => {
    const forged = await api.request(student, '/auth/v1/user', {
      method: 'PUT', body: { data: { role: 'manager', school_id: schoolB, fixture_key: 'DEMO_A_MANAGER', operator: true } },
    })
    assert.ok(forged.ok, 'Could not establish ordinary editable-metadata attack fixture')
    assert.equal((await api.rows(student, 'memberships')).length, 0)
    const results = await Promise.all([1, 2].map(() => api.rpc(student, 'join_demo_school', { p_access_code: code, p_display_label: '  New demo student  ' })))
    for (const result of results) assert.ok(result.ok && result.data && !Array.isArray(result.data), `Enrollment did not return one membership (${safeCode(result)})`)
    original = results[0].data
    assert.deepEqual(results[1].data, original, 'Concurrent calls returned different memberships')
    assert.deepEqual(Object.keys(original).sort(), ['school_id', 'user_id', 'role', 'active', 'display_label', 'created_at'].sort())
    assert.ok(original.school_id === schoolA && original.user_id === student.userId && original.role === 'member' && original.active && original.display_label === 'New demo student')
    assert.ok(Number.isFinite(Date.parse(original.created_at)), 'Membership lacks server creation time')
    const rows = await api.rows(student, 'memberships')
    assert.equal(rows.length, 1)
    assert.deepEqual(rows[0], original)
    const retry = await api.rpc(student, 'join_demo_school', { p_access_code: 'old-or-rotated-code', p_display_label: 'Must not rename' })
    assert.ok(retry.ok, 'Idempotent enrollment retry failed')
    assert.deepEqual(retry.data, original, 'Retry changed original membership')
    expectHidden(await api.read(student, 'schools', { id: `eq.${schoolB}` }), 'Registered student cannot read School B')
    for (const table of ['item_staff', 'item_events']) expectHidden(await api.read(student, table), `Registered student private ${table}`)
    const user = await api.request(student, '/auth/v1/user')
    assert.ok(user.ok && !JSON.stringify(user.data).includes(code), 'Enrollment code leaked into Auth metadata/identities')
  })

  test('the registered student can reserve and receive an item but cannot perform manager actions', async () => {
    const itemId = await api.available(manager, schoolA)
    const reservation = mutation(await api.rpc(student, 'reserve_item', { p_item_id: itemId }), 'Registered student reservation')
    expectFailure(await api.rpc(student, 'complete_pickup', { p_reservation_id: reservation.reservation_id }), ['SL002'], 'Registered student cannot confirm pickup')
    const completed = mutation(await api.rpc(manager, 'complete_pickup', { p_reservation_id: reservation.reservation_id }), 'Manager pickup for registered student')
    assert.ok(completed.changed && completed.item_status === 'transferred')
    assert.deepEqual((await api.rows(student, 'memberships'))[0], original)
  })
})
