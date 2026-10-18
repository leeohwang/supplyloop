import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import {
  accountNames, clothingDetails, DemoApi, expectEvent, expectFailure, expectHidden, expectPermissionFailure,
  mutation, readTestConfig, runLabel, safeCode, textbookDetails,
} from '../helpers/supabase.mjs'

// Ordinary sessions only. These tests retain fictional QA item/event history and never reset shared data.
describe('SupplyLoop hosted API acceptance', { concurrency: false, timeout: 300_000 }, () => {
  let api
  const actors = {}
  const schools = {}
  const baseline = {}

  before(async () => {
    api = new DemoApi(readTestConfig())
    for (const name of accountNames) actors[name] = await api.login(name)
    for (const letter of ['A', 'B']) {
      const manager = actors[`${letter}_MANAGER`]
      const rows = await api.rows(manager, 'schools', { slug: `eq.school-${letter.toLowerCase()}` })
      assert.equal(rows.length, 1, `School ${letter} must be provisioned and readable to its manager`)
      schools[letter] = rows[0].id
      baseline[letter] = await api.available(manager, rows[0].id)
      baseline[`${letter}_reservation`] = mutation(await api.rpc(actors[`${letter}_MEMBER1`], 'reserve_item', {
        p_item_id: baseline[letter],
      }), `School ${letter} baseline reservation`).reservation_id
    }
  })

  after(async () => {
    if (!api) return
    for (const actor of Object.values(actors)) {
      const response = await api.logout(actor)
      assert.ok(response.ok, `Could not terminate test session for ${actor.name} (HTTP ${response.status})`)
    }
  })

  test('each member reads only their own active membership; managers read school-local labels', async () => {
    for (const letter of ['A', 'B']) {
      for (const suffix of ['MEMBER1', 'MEMBER2']) {
        const actor = actors[`${letter}_${suffix}`]
        const rows = await api.rows(actor, 'memberships')
        assert.equal(rows.length, 1)
        assert.ok(rows.every((row) => row.user_id === actor.userId && row.school_id === schools[letter] && row.active && row.role === 'member'), 'Member membership visibility or role is incorrect')
      }
      const rows = await api.rows(actors[`${letter}_MANAGER`], 'memberships')
      assert.ok(rows.every((row) => row.school_id === schools[letter] && !('email' in row)), 'Manager labels must be school-local and contain no Auth email')
      assert.equal(new Set(rows.map((row) => row.user_id)).size, rows.length, 'Manager membership rows must not repeat a user')
      const fixedIds = new Set()
      for (const suffix of ['MANAGER', 'MEMBER1', 'MEMBER2']) {
        const userId = actors[`${letter}_${suffix}`].userId
        fixedIds.add(userId)
        const matching = rows.filter((row) => row.user_id === userId)
        const label = `School ${letter} ${suffix === 'MANAGER' ? 'manager' : suffix === 'MEMBER1' ? 'member 1' : 'member 2'}`
        assert.ok(matching.length === 1 && matching[0].active === true
          && matching[0].role === (suffix === 'MANAGER' ? 'manager' : 'member')
          && matching[0].display_label === label, 'A fixed fixture membership identity, label, role, or active state changed')
      }
      const registered = rows.filter((row) => !fixedIds.has(row.user_id))
      assert.ok(registered.every((row) => letter === 'A' && row.role === 'member' && row.active === true
        && typeof row.display_label === 'string' && row.display_label.trim().length > 0),
      'Additional demo memberships must be active School A students with a display label')
    }
  })

  test('cross-school reads and joins reveal no rows across all six core tables', async () => {
    for (const name of ['A_MEMBER1', 'A_MANAGER']) {
      for (const table of ['schools', 'memberships', 'items', 'item_staff', 'reservations', 'item_events']) {
        const query = table === 'schools' ? { id: `eq.${schools.B}` } : { school_id: `eq.${schools.B}` }
        expectHidden(await api.read(actors[name], table, query), `${name}: cross-school ${table}`)
      }
    }
    expectHidden(await api.read(actors.A_MANAGER, 'reservations', {
      school_id: `eq.${schools.B}`, select: 'id,item:items(id,title),member:memberships!reservations_school_id_member_id_fkey(display_label)',
    }), 'Cross-school embedded reservation read')
    for (const table of ['item_staff', 'item_events']) {
      expectHidden(await api.read(actors.A_MEMBER1, table, { school_id: `eq.${schools.A}` }), `Member private ${table}`)
    }
    expectHidden(await api.read(actors.A_MEMBER2, 'reservations', { id: `eq.${baseline.A_reservation}` }), 'Another member reservation')
    const item = await api.rows(actors.A_MEMBER1, 'items', { id: `eq.${baseline.A}` })
    assert.equal(item.length, 1)
    assert.ok(!('storage_code' in item[0]) && !('inspected_by' in item[0]), 'Catalog contains staff fields')
  })

  test('wrong-school RPC targets match missing targets, without existence or state leaks', async () => {
    const missing = randomUUID()
    const operations = [
      ['publish_item', { p_inspection_confirmed: true }, 'p_item_id', baseline.B],
      ['update_item_details', { p_details: clothingDetails(), p_storage_code: 'QA unchanged' }, 'p_item_id', baseline.B],
      ['reserve_item', {}, 'p_item_id', baseline.B],
      ['retire_item', { p_reason: 'missing' }, 'p_item_id', baseline.B],
      ['cancel_reservation', { p_release_reason: 'uncollected' }, 'p_reservation_id', baseline.B_reservation],
      ['complete_pickup', {}, 'p_reservation_id', baseline.B_reservation],
    ]
    for (const [operation, args, idKey, existingId] of operations) {
      const outside = await api.rpc(actors.A_MANAGER, operation, { ...args, [idKey]: existingId })
      const absent = await api.rpc(actors.A_MANAGER, operation, { ...args, [idKey]: missing })
      expectFailure(outside, ['SL003'], `${operation}: inaccessible target`)
      expectFailure(absent, ['SL003'], `${operation}: missing target`)
      assert.ok(outside.status === absent.status && outside.data.message === absent.data.message && outside.data.details === absent.data.details && outside.data.hint === absent.data.hint, `${operation}: inaccessible and absent targets have distinguishable errors`)
    }
    expectFailure(await api.rpc(actors.A_MANAGER, 'intake_item', {
      p_school_id: schools.B, p_category: 'clothing', p_details: clothingDetails(), p_storage_code: 'QA denied',
    }), ['SL002'], 'Intake into unauthorized school')
    const other = await api.rpc(actors.A_MEMBER2, 'cancel_reservation', { p_reservation_id: baseline.A_reservation, p_release_reason: null })
    const absent = await api.rpc(actors.A_MEMBER2, 'cancel_reservation', { p_reservation_id: missing, p_release_reason: null })
    expectFailure(other, ['SL003'], 'Cancellation of another member reservation')
    assert.ok(other.status === absent.status && other.data.code === absent.data.code && other.data.message === absent.data.message, 'Private reservation existence leaked')
  })

  test('anonymous reads/RPCs and private-schema API access are denied', async () => {
    for (const table of ['schools', 'memberships', 'items', 'item_staff', 'reservations', 'item_events']) {
      expectPermissionFailure(await api.read(null, table), `Anonymous ${table}`)
    }
    const calls = [
      ['intake_item', { p_school_id: schools.A, p_category: 'clothing', p_details: clothingDetails(), p_storage_code: 'QA denied' }],
      ['publish_item', { p_item_id: baseline.A, p_inspection_confirmed: true }],
      ['update_item_details', { p_item_id: baseline.A, p_details: clothingDetails(), p_storage_code: 'QA denied' }],
      ['reserve_item', { p_item_id: baseline.A }],
      ['cancel_reservation', { p_reservation_id: baseline.A_reservation, p_release_reason: null }],
      ['complete_pickup', { p_reservation_id: baseline.A_reservation }],
      ['retire_item', { p_item_id: baseline.A, p_reason: 'missing' }],
    ]
    for (const [name, args] of calls) expectPermissionFailure(await api.rpc(null, name, args), `Anonymous ${name}`)
    const privateRead = await api.request(actors.A_MANAGER, '/rest/v1/items', { headers: { 'Accept-Profile': 'private' } })
    expectFailure(privateRead, ['PGRST106'], 'Private schema read exposure')
    const privateRpc = await api.request(actors.A_MANAGER, '/rest/v1/rpc/reserve_item', {
      method: 'POST', body: { p_item_id: baseline.A }, headers: { 'Content-Profile': 'private' },
    })
    expectFailure(privateRpc, ['PGRST106'], 'Private schema RPC exposure')
  })

  test('direct insert/update/delete privileges are absent for both members and managers', async () => {
    const nonexistent = randomUUID()
    const operations = {
      schools: { filter: { id: `eq.${schools.A}` }, noMatch: { id: `eq.${nonexistent}` }, update: { name: 'School A' }, insert: { id: nonexistent, name: 'QA denied', slug: runLabel, enabled_categories: ['clothing'], pickup_label: 'Main office pickup', term_label: 'Demo term' } },
      memberships: { filter: { school_id: `eq.${schools.A}`, user_id: `eq.${actors.A_MEMBER1.userId}` }, noMatch: { user_id: `eq.${nonexistent}` }, update: { role: 'member' }, insert: { school_id: schools.A, user_id: actors.A_MEMBER1.userId, role: 'manager', active: true, display_label: 'QA denied' } },
      items: { filter: { id: `eq.${baseline.A}` }, noMatch: { id: `eq.${nonexistent}` }, update: { school_id: schools.A }, insert: { id: nonexistent, school_id: schools.A, item_code: runLabel, category: 'clothing', status: 'available' } },
      item_staff: { filter: { item_id: `eq.${baseline.A}` }, noMatch: { item_id: `eq.${nonexistent}` }, update: { inspection_passed: true }, insert: { school_id: schools.A, item_id: baseline.A, storage_code: 'QA denied', inspection_passed: false, received_by: actors.A_MANAGER.userId } },
      reservations: { filter: { id: `eq.${baseline.A_reservation}` }, noMatch: { id: `eq.${nonexistent}` }, update: { status: 'active' }, insert: { id: nonexistent, school_id: schools.A, item_id: baseline.A, member_id: actors.A_MEMBER2.userId, status: 'active' } },
      item_events: { filter: { item_id: `eq.${baseline.A}` }, noMatch: { id: `eq.${nonexistent}` }, update: { school_id: schools.A }, insert: { id: nonexistent, school_id: schools.A, item_id: baseline.A, action: 'intake_received', actor_id: actors.A_MEMBER1.userId } },
    }
    for (const actor of [actors.A_MEMBER1, actors.A_MANAGER]) {
      for (const [table, operation] of Object.entries(operations)) {
        for (const request of [
          { method: 'POST', body: operation.insert },
          { method: 'PATCH', body: operation.update, query: operation.filter },
          // Delete a nonexistent key: even a broken grant must not erase shared demo rows.
          { method: 'DELETE', query: operation.noMatch },
        ]) {
          expectFailure(await api.request(actor, `/rest/v1/${table}`, request), ['42501'], `${actor.name} direct ${request.method} ${table}`)
        }
      }
    }
  })

  test('members cannot execute manager mutations on readable stock', async () => {
    const itemId = await api.available(actors.A_MANAGER, schools.A)
    const beforeState = await api.snapshot(actors.A_MANAGER, itemId)
    const calls = [
      ['intake_item', { p_school_id: schools.A, p_category: 'clothing', p_details: clothingDetails(), p_storage_code: 'QA denied' }],
      ['publish_item', { p_item_id: itemId, p_inspection_confirmed: true }],
      ['update_item_details', { p_item_id: itemId, p_details: clothingDetails(), p_storage_code: 'QA denied' }],
      ['retire_item', { p_item_id: itemId, p_reason: 'missing' }],
    ]
    for (const [name, args] of calls) expectFailure(await api.rpc(actors.A_MEMBER1, name, args), ['SL002'], `Member ${name}`)
    assert.ok(await api.snapshot(actors.A_MANAGER, itemId) === beforeState, 'Denied manager mutations changed stock/history')
  })

  test('managers cannot reserve stock; denial preserves inventory, allocations, and audit history', async () => {
    for (const letter of ['A', 'B']) {
      const manager = actors[`${letter}_MANAGER`]
      const student = actors[`${letter}_MEMBER1`]
      const itemId = await api.available(manager, schools[letter])
      const snapshot = await api.snapshot(manager, itemId)
      expectFailure(await api.rpc(manager, 'reserve_item', { p_item_id: itemId }), ['SL002'], `School ${letter} manager reservation`)
      assert.ok(await api.snapshot(manager, itemId) === snapshot, 'Denied manager reservation changed inventory, allocations, or audit events')
      assert.equal((await api.rows(manager, 'reservations', { item_id: `eq.${itemId}` })).length, 0, 'Manager denial created an allocation')
      const studentReservation = mutation(await api.rpc(student, 'reserve_item', { p_item_id: itemId }), 'Student reservation after manager denial')
      assert.ok(studentReservation.item_status === 'reserved' && studentReservation.reservation_status === 'active', 'Manager denial prevented a valid student reservation')
      const stored = await api.rows(manager, 'reservations', { id: `eq.${studentReservation.reservation_id}` })
      assert.ok(stored.length === 1 && stored[0].member_id === student.userId, 'Allocation recipient is not the authenticated student')
    }
  })

  test('closed JSON and nullable drafts reject invalid values without partial writes', async () => {
    const beforeItems = await api.rows(actors.A_MANAGER, 'items', { school_id: `eq.${schools.A}`, select: 'id' })
    const missingKey = clothingDetails()
    delete missingKey.title
    const invalid = [null, [], 'not an object', missingKey,
      clothingDetails({ title: 3 }), clothingDetails({ condition: 'excellent' }),
      clothingDetails({ garment_type: 'shoes' }), clothingDetails({ size_system: 'numeric' }),
      clothingDetails({ size_label: 'XXXL' }), clothingDetails({ isbn13: null }),
      clothingDetails({ school_id: schools.B }), clothingDetails({ status: 'available' }),
      clothingDetails({ measurements: 'Chest 90', measurement_unit: null }),
      clothingDetails({ measurements: null, measurement_unit: 'cm' }),
      clothingDetails({ measurement_unit: 'ft', measurements: 'Chest 3' }),
    ]
    for (const details of invalid) expectFailure(await api.rpc(actors.A_MANAGER, 'intake_item', {
      p_school_id: schools.A, p_category: 'clothing', p_details: details, p_storage_code: 'QA rejected',
    }), ['SL004'], 'Invalid clothing JSON')
    for (const details of [textbookDetails({ isbn13: '9780131103628' }), textbookDetails({ requires_digital_code: 'false' }), textbookDetails({ size_label: null })]) {
      expectFailure(await api.rpc(actors.A_MANAGER, 'intake_item', { p_school_id: schools.A, p_category: 'textbook', p_details: details, p_storage_code: 'QA rejected' }), ['SL004'], 'Invalid textbook JSON')
    }
    const afterItems = await api.rows(actors.A_MANAGER, 'items', { school_id: `eq.${schools.A}`, select: 'id' })
    assert.equal(afterItems.length, beforeItems.length, 'Invalid intake created partial items')
    for (const category of ['clothing', 'textbook']) {
      const details = category === 'clothing' ? clothingDetails({ title: null, condition: null, size_label: null }) : textbookDetails({ title: null, isbn13: null, requires_digital_code: null, is_consumable: null })
      const itemId = mutation(await api.rpc(actors.A_MANAGER, 'intake_item', { p_school_id: schools.A, p_category: category, p_details: details, p_storage_code: null }), 'Incomplete draft intake').item_id
      expectHidden(await api.read(actors.A_MEMBER1, 'items', { id: `eq.${itemId}` }), 'Member draft visibility')
      const snapshot = await api.snapshot(actors.A_MANAGER, itemId)
      for (const confirmed of [null, false, true]) expectFailure(await api.rpc(actors.A_MANAGER, 'publish_item', { p_item_id: itemId, p_inspection_confirmed: confirmed }), ['SL005'], 'Incomplete/unconfirmed publication')
      assert.ok(await api.snapshot(actors.A_MANAGER, itemId) === snapshot, 'Failed publication changed draft/staff/events')
    }
    for (const overrides of [{ requires_digital_code: null }, { is_consumable: null }, { requires_digital_code: true }, { is_consumable: true }]) {
      const itemId = await api.intake(actors.A_MANAGER, schools.A, 'textbook', overrides)
      const snapshot = await api.snapshot(actors.A_MANAGER, itemId)
      expectFailure(await api.rpc(actors.A_MANAGER, 'publish_item', { p_item_id: itemId, p_inspection_confirmed: true }), ['SL005'], 'Unapproved reusable book flags')
      assert.ok(await api.snapshot(actors.A_MANAGER, itemId) === snapshot, 'Excluded book publication changed state')
    }
  })

  test('draft correction, both-category publication, and exact matching use approved fields', async () => {
    const clothingId = await api.intake(actors.A_MANAGER, schools.A, 'clothing', { title: null, size_label: null })
    const auditScope = { schoolId: schools.A, itemId: clothingId, actorId: actors.A_MANAGER.userId }
    const receiptEvents = await api.rows(actors.A_MANAGER, 'item_events', { item_id: `eq.${clothingId}` })
    assert.equal(receiptEvents.length, 1, 'Receipt must append exactly one event')
    const receiptEvent = expectEvent(receiptEvents, 'intake_received', auditScope)
    mutation(await api.rpc(actors.A_MANAGER, 'update_item_details', { p_item_id: clothingId, p_details: clothingDetails({ size_label: 'L', measurements: 'Chest 100', measurement_unit: 'cm' }), p_storage_code: 'QA corrected shelf' }), 'Draft correction')
    const correctionEvents = await api.rows(actors.A_MANAGER, 'item_events', { item_id: `eq.${clothingId}` })
    assert.equal(correctionEvents.length, 2, 'Correction must append one event and retain receipt history')
    expectEvent(correctionEvents, 'details_updated', auditScope)
    assert.ok(correctionEvents.some((event) => event.id === receiptEvent.id), 'Correction replaced the original receipt event')
    mutation(await api.rpc(actors.A_MANAGER, 'publish_item', { p_item_id: clothingId, p_inspection_confirmed: true }), 'Corrected clothing publication')
    const publishedEvents = await api.rows(actors.A_MANAGER, 'item_events', { item_id: `eq.${clothingId}` })
    assert.equal(publishedEvents.length, 3, 'Publication must append one event without replacing earlier history')
    for (const action of ['intake_received', 'details_updated', 'published']) expectEvent(publishedEvents, action, auditScope)
    const publicationEvent = publishedEvents.find((event) => event.action === 'published')
    const staff = await api.rows(actors.A_MANAGER, 'item_staff', { item_id: `eq.${clothingId}` })
    assert.ok(staff.length === 1 && staff[0].received_by === actors.A_MANAGER.userId && staff[0].inspected_by === actors.A_MANAGER.userId && staff[0].inspection_passed, 'Receipt/inspection fields do not attribute the authenticated manager')
    assert.ok(Date.parse(staff[0].received_at) === Date.parse(receiptEvent.created_at) && Date.parse(staff[0].inspected_at) === Date.parse(publicationEvent.created_at), 'Staff attribution times differ from their audit events')
    const bookId = await api.available(actors.A_MANAGER, schools.A, 'textbook')
    const bookEvents = await api.rows(actors.A_MANAGER, 'item_events', { item_id: `eq.${bookId}` })
    assert.equal(bookEvents.length, 2, 'Book intake/publication must each append one event')
    for (const action of ['intake_received', 'published']) expectEvent(bookEvents, action, { ...auditScope, itemId: bookId })
    const wrongEditionId = await api.available(actors.A_MANAGER, schools.A, 'textbook', { edition: '3rd' })
    const otherIsbnId = await api.available(actors.A_MANAGER, schools.A, 'textbook', { isbn13: '9780262033848' })
    const clothing = await api.rows(actors.A_MEMBER1, 'items', { school_id: `eq.${schools.A}`, status: 'eq.available', approved_at: 'not.is.null', category: 'eq.clothing', size_system: 'eq.letter', size_label: 'eq.L', garment_type: 'eq.shirt' })
    assert.ok(clothing.some((row) => row.id === clothingId), 'Matching clothing was excluded')
    const wrongSize = await api.rows(actors.A_MEMBER1, 'items', { id: `eq.${clothingId}`, size_label: 'eq.M', status: 'eq.available' })
    assert.equal(wrongSize.length, 0)
    const books = await api.rows(actors.A_MEMBER1, 'items', { school_id: `eq.${schools.A}`, status: 'eq.available', approved_at: 'not.is.null', category: 'eq.textbook', isbn13: 'eq.9780131103627', edition: 'eq.2nd', order: 'available_at.asc,id.asc' })
    assert.ok(books.some((row) => row.id === bookId), 'Exact ISBN/edition match was excluded')
    assert.ok(books.every((row) => row.id !== wrongEditionId && row.id !== otherIsbnId && row.school_id === schools.A), 'Wrong edition, ISBN, or school entered results')
    for (const itemId of [clothingId, bookId]) {
      const result = mutation(await api.rpc(actors.A_MEMBER1, 'reserve_item', { p_item_id: itemId }), 'Category reservation')
      assert.equal(result.reservation_status, 'active')
      const reloaded = await api.rows(actors.A_MEMBER1, 'reservations', { id: `eq.${result.reservation_id}`, select: 'id,status,item:items(id,title,status)' })
      assert.ok(reloaded.length === 1 && reloaded[0].item?.id === itemId && reloaded[0].item.status === 'reserved', 'Owned reserved item details did not survive a fresh API read')
    }
  })

  test('minimum condition Good includes New/Like new/Good and excludes Fair', async () => {
    const ids = {}
    for (const condition of ['new', 'like_new', 'good', 'fair']) ids[condition] = await api.available(actors.A_MANAGER, schools.A, 'clothing', { condition })
    const rows = await api.rows(actors.A_MEMBER1, 'items', { school_id: `eq.${schools.A}`, status: 'eq.available', condition: 'in.(new,like_new,good)', id: `in.(${Object.values(ids).join(',')})` })
    assert.ok(rows.length === 3 && ['new', 'like_new', 'good'].every((condition) => rows.some((row) => row.id === ids[condition])) && !rows.some((row) => row.id === ids.fair), 'Condition filter used the wrong quality order')
  })

  test('two members racing for one physical item create exactly one allocation and event', async () => {
    const itemId = await api.available(actors.A_MANAGER, schools.A)
    const requests = [actors.A_MEMBER1, actors.A_MEMBER2].map((actor) => api.rpc(actor, 'reserve_item', { p_item_id: itemId }))
    const responses = await Promise.all(requests)
    assert.equal(responses.filter((response) => response.ok).length, 1)
    expectFailure(responses.find((response) => !response.ok), ['SL007', 'SL008'], 'Losing reservation request')
    const winner = mutation(responses.find((response) => response.ok), 'Winning reservation')
    const reservations = await api.rows(actors.A_MANAGER, 'reservations', { item_id: `eq.${itemId}` })
    const events = await api.rows(actors.A_MANAGER, 'item_events', { item_id: `eq.${itemId}`, action: 'eq.reserved' })
    assert.ok(reservations.length === 1 && reservations[0].id === winner.reservation_id && reservations[0].status === 'active', 'Race produced duplicate or invalid allocation')
    assert.equal(events.length, 1)
    const find = await api.rows(actors.A_MEMBER1, 'items', { id: `eq.${itemId}`, status: 'eq.available' })
    assert.equal(find.length, 0, 'Reserved item remained available in Find')
  })

  test('owner cancellation and manager release restore stock and preserve controlled reasons', async () => {
    const itemId = await api.available(actors.A_MANAGER, schools.A)
    const first = mutation(await api.rpc(actors.A_MEMBER1, 'reserve_item', { p_item_id: itemId }), 'First reservation')
    const cancelled = mutation(await api.rpc(actors.A_MEMBER1, 'cancel_reservation', { p_reservation_id: first.reservation_id, p_release_reason: null }), 'Owner cancellation')
    assert.ok(cancelled.item_status === 'available' && cancelled.reservation_status === 'cancelled')
    const storedFirst = await api.rows(actors.A_MANAGER, 'reservations', { id: `eq.${first.reservation_id}` })
    assert.ok(storedFirst[0].cancel_reason === 'member_cancelled' && storedFirst[0].cancelled_by === actors.A_MEMBER1.userId)
    const second = mutation(await api.rpc(actors.A_MEMBER2, 'reserve_item', { p_item_id: itemId }), 'Reservation after cancellation')
    const snapshot = await api.snapshot(actors.A_MANAGER, itemId)
    expectFailure(await api.rpc(actors.A_MEMBER2, 'cancel_reservation', { p_reservation_id: second.reservation_id, p_release_reason: 'uncollected' }), ['SL002'], 'Member manager-release attempt')
    expectFailure(await api.rpc(actors.A_MANAGER, 'cancel_reservation', { p_reservation_id: second.reservation_id, p_release_reason: 'arbitrary' }), ['SL004'], 'Invalid release reason')
    assert.ok(await api.snapshot(actors.A_MANAGER, itemId) === snapshot, 'Rejected release changed inventory/history')
    mutation(await api.rpc(actors.A_MANAGER, 'cancel_reservation', { p_reservation_id: second.reservation_id, p_release_reason: 'uncollected' }), 'Manager release')
    const events = await api.rows(actors.A_MANAGER, 'item_events', { item_id: `eq.${itemId}`, order: 'created_at.asc,id.asc' })
    assert.ok(events.filter((event) => event.action === 'cancelled' && event.reason === 'member_cancelled').length === 1 && events.filter((event) => event.action === 'released' && event.reason === 'uncollected').length === 1, 'Cancellation/release audit records are incorrect')
    assert.equal((await api.rows(actors.A_MEMBER1, 'items', { id: `eq.${itemId}`, status: 'eq.available' })).length, 1)
  })

  test('student pickup is manager-confirmed, terminal, idempotent, and retains only the owner item history', async () => {
    const itemId = await api.available(actors.A_MANAGER, schools.A, 'textbook')
    const reservation = mutation(await api.rpc(actors.A_MEMBER1, 'reserve_item', { p_item_id: itemId }), 'Pickup reservation')
    expectFailure(await api.rpc(actors.A_MEMBER1, 'complete_pickup', { p_reservation_id: reservation.reservation_id }), ['SL002'], 'Member pickup confirmation')
    const recipient = await api.rows(actors.A_MANAGER, 'memberships', { school_id: `eq.${schools.A}`, user_id: `eq.${actors.A_MEMBER1.userId}` })
    assert.ok(recipient.length === 1 && recipient[0].active && recipient[0].role === 'member', 'The first pickup recipient must be a current active student')
    const completed = mutation(await api.rpc(actors.A_MANAGER, 'complete_pickup', { p_reservation_id: reservation.reservation_id }), 'Manager pickup')
    assert.ok(completed.changed && completed.item_status === 'transferred' && completed.reservation_status === 'completed' && Number.isFinite(Date.parse(completed.completed_at)), 'Pickup did not record a terminal completion')
    const pickupEvents = await api.rows(actors.A_MANAGER, 'item_events', { item_id: `eq.${itemId}` })
    assert.equal(pickupEvents.length, 4, 'Initial pickup must append one event and retain receipt/publication/reservation history')
    const auditScope = { schoolId: schools.A, itemId, actorId: actors.A_MANAGER.userId }
    for (const action of ['intake_received', 'published']) expectEvent(pickupEvents, action, auditScope)
    expectEvent(pickupEvents, 'reserved', { ...auditScope, actorId: actors.A_MEMBER1.userId, reservationId: reservation.reservation_id })
    const pickupEvent = expectEvent(pickupEvents, 'pickup_completed', { ...auditScope, reservationId: reservation.reservation_id })
    assert.ok(Date.parse(pickupEvent.created_at) === Date.parse(completed.completed_at), 'Pickup audit time differs from its original completion time')
    const snapshot = await api.snapshot(actors.A_MANAGER, itemId)
    const repeated = mutation(await api.rpc(actors.A_MANAGER, 'complete_pickup', { p_reservation_id: reservation.reservation_id }), 'Repeated pickup')
    assert.ok(!repeated.changed && repeated.completed_at === completed.completed_at && repeated.reservation_id === completed.reservation_id, 'Repeated pickup changed original completion')
    assert.ok(await api.snapshot(actors.A_MANAGER, itemId) === snapshot, 'Repeated pickup rewrote actor/time or appended an event')
    const stored = await api.rows(actors.A_MANAGER, 'reservations', { id: `eq.${reservation.reservation_id}` })
    assert.ok(stored[0].completed_by === actors.A_MANAGER.userId && stored[0].member_id === actors.A_MEMBER1.userId)
    const owned = await api.rows(actors.A_MEMBER1, 'reservations', { id: `eq.${reservation.reservation_id}`, select: 'id,status,item:items(id,title,status)' })
    assert.ok(owned.length === 1 && owned[0].item?.id === itemId && owned[0].item.status === 'transferred', 'Completed owner item history vanished')
    expectHidden(await api.read(actors.A_MEMBER2, 'items', { id: `eq.${itemId}` }), 'Unrelated transferred item read')
    expectFailure(await api.rpc(actors.A_MEMBER1, 'reserve_item', { p_item_id: itemId }), ['SL007', 'SL006'], 'Repeat permanent transfer allocation')
    expectFailure(await api.rpc(actors.A_MANAGER, 'cancel_reservation', { p_reservation_id: reservation.reservation_id, p_release_reason: 'uncollected' }), ['SL006'], 'Cancellation of completed pickup')
    expectFailure(await api.rpc(actors.A_MANAGER, 'retire_item', { p_item_id: itemId, p_reason: 'missing' }), ['SL006'], 'Retirement of transferred item')
    assert.ok(await api.snapshot(actors.A_MANAGER, itemId) === snapshot, 'Invalid terminal transition changed history')
  })

  test('invalid transitions and incomplete available corrections leave all related rows unchanged', async () => {
    const itemId = await api.available(actors.A_MANAGER, schools.A)
    const availableSnapshot = await api.snapshot(actors.A_MANAGER, itemId)
    expectFailure(await api.rpc(actors.A_MANAGER, 'update_item_details', { p_item_id: itemId, p_details: clothingDetails({ title: null }), p_storage_code: 'QA must roll back' }), ['SL005'], 'Incomplete available correction')
    assert.ok(await api.snapshot(actors.A_MANAGER, itemId) === availableSnapshot, 'Invalid correction changed item/staff/audit data')
    const reservation = mutation(await api.rpc(actors.A_MEMBER1, 'reserve_item', { p_item_id: itemId }), 'Transition fixture reservation')
    const reservedSnapshot = await api.snapshot(actors.A_MANAGER, itemId)
    for (const [name, args] of [
      ['publish_item', { p_item_id: itemId, p_inspection_confirmed: true }],
      ['update_item_details', { p_item_id: itemId, p_details: clothingDetails(), p_storage_code: 'QA denied' }],
      ['retire_item', { p_item_id: itemId, p_reason: 'damaged' }],
    ]) expectFailure(await api.rpc(actors.A_MANAGER, name, args), ['SL006'], `Invalid reserved ${name}`)
    assert.ok(await api.snapshot(actors.A_MANAGER, itemId) === reservedSnapshot, 'Invalid reserved transition partially changed records')
    mutation(await api.rpc(actors.A_MANAGER, 'cancel_reservation', { p_reservation_id: reservation.reservation_id, p_release_reason: 'stock_issue' }), 'Release before retirement')
    const retired = mutation(await api.rpc(actors.A_MANAGER, 'retire_item', { p_item_id: itemId, p_reason: 'damaged' }), 'Eligible retirement')
    assert.equal(retired.item_status, 'retired')
    expectHidden(await api.read(actors.A_MEMBER1, 'items', { id: `eq.${itemId}` }), 'Retired catalog visibility')
    const events = await api.rows(actors.A_MANAGER, 'item_events', { item_id: `eq.${itemId}`, action: 'eq.retired' })
    assert.ok(events.length === 1 && events[0].reason === 'damaged')
  })

  test('local sign-out revokes only its refresh session and keeps membership/inventory unchanged', async () => {
    const first = await api.login('A_MEMBER2')
    let second = await api.login('A_MEMBER2')
    try {
      const membershipsBefore = await api.rows(actors.A_MANAGER, 'memberships', { user_id: `eq.${first.userId}` })
      const snapshot = await api.snapshot(actors.A_MANAGER, baseline.A)
      const signedOut = await api.logout(first)
      assert.ok(signedOut.ok, `Local sign-out failed (HTTP ${signedOut.status})`)
      const firstRefresh = await api.request(null, '/auth/v1/token', { method: 'POST', query: { grant_type: 'refresh_token' }, body: { refresh_token: first.refreshToken } })
      assert.ok(!firstRefresh.ok && [400, 401, 403].includes(firstRefresh.status), 'Signed-out session could still refresh')
      const secondRefresh = await api.request(null, '/auth/v1/token', { method: 'POST', query: { grant_type: 'refresh_token' }, body: { refresh_token: second.refreshToken } })
      assert.ok(secondRefresh.ok && secondRefresh.data?.user?.id === second.userId, 'Local sign-out terminated an independent session')
      second = { ...second, accessToken: secondRefresh.data.access_token, refreshToken: secondRefresh.data.refresh_token }
      assert.equal((await api.rows(second, 'memberships')).length, 1)
      const membershipsAfter = await api.rows(actors.A_MANAGER, 'memberships', { user_id: `eq.${first.userId}` })
      assert.ok(JSON.stringify(membershipsBefore) === JSON.stringify(membershipsAfter) && await api.snapshot(actors.A_MANAGER, baseline.A) === snapshot, 'Sign-out changed membership or business data')
      // Existing access JWTs may remain valid until expiry; immediate JWT invalidation is not promised.
    } finally {
      const response = await api.logout(second)
      assert.ok(response.ok, `Independent test-session cleanup failed (HTTP ${response.status}; ${safeCode(response)})`)
    }
  })
})
