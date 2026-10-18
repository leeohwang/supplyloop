import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

export const accountNames = ['A_MANAGER', 'A_MEMBER1', 'A_MEMBER2', 'B_MANAGER', 'B_MEMBER1', 'B_MEMBER2']
export const runLabel = `QA-${Date.now()}-${randomUUID().slice(0, 8)}`

export function readTestConfig() {
  const names = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', ...accountNames.flatMap((name) => [
    `DEMO_${name}_EMAIL`, `DEMO_${name}_PASSWORD`,
  ])]
  const missing = names.filter((name) => !process.env[name]?.trim())
  assert.ok(missing.length === 0, `Missing required test configuration: ${missing.join(', ')}`)
  const url = new URL(process.env.SUPABASE_URL)
  assert.ok(url.protocol === 'https:' && !url.username && !url.password, 'Tests require an HTTPS demo project URL without embedded credentials')
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  assert.ok(key.startsWith('sb_publishable_'), 'API tests require a publishable key, never a secret or service-role key')
  return { url: url.origin, key }
}

export function safeCode(response) {
  const code = response.data?.code ?? response.data?.error_code
  return typeof code === 'string' && /^[A-Za-z0-9_]{1,50}$/.test(code) ? code : 'unrecognized'
}

export function expectFailure(response, codes, label) {
  assert.ok(!response.ok, `${label}: request unexpectedly succeeded`)
  assert.ok(codes.includes(safeCode(response)), `${label}: unexpected error code ${safeCode(response)} (HTTP ${response.status})`)
}

export function expectPermissionFailure(response, label) {
  assert.ok(!response.ok && [401, 403].includes(response.status), `${label}: expected an authorization rejection, got HTTP ${response.status}`)
  assert.ok(['42501', 'SL001', 'SL002', 'PGRST301', 'PGRST302', 'PGRST303'].includes(safeCode(response)), `${label}: authorization error code missing`)
}

export function expectHidden(response, label) {
  if (response.ok) {
    assert.ok(Array.isArray(response.data) && response.data.length === 0, `${label}: private rows were readable`)
  } else {
    expectPermissionFailure(response, label)
  }
}

export function expectEvent(events, action, { schoolId, itemId, actorId, reservationId = null, reason = null }) {
  const matching = events.filter((event) => event.action === action)
  assert.equal(matching.length, 1, `${action}: expected exactly one audit event`)
  const event = matching[0]
  assert.ok(event.school_id === schoolId && event.item_id === itemId, `${action}: event has incorrect item/school scope`)
  assert.ok(event.actor_id === actorId, `${action}: audit actor does not match the authenticated caller`)
  assert.ok(event.reservation_id === reservationId && event.reason === reason, `${action}: unexpected reservation or reason attribution`)
  assert.ok(typeof event.created_at === 'string' && Number.isFinite(Date.parse(event.created_at)), `${action}: server timestamp is missing or invalid`)
  return event
}

export function mutation(response, label) {
  assert.ok(response.ok, `${label}: RPC failed with ${safeCode(response)} (HTTP ${response.status})`)
  assert.ok(response.data && !Array.isArray(response.data) && typeof response.data === 'object', `${label}: RPC must return exactly one singular result`)
  const expectedKeys = ['school_id', 'item_id', 'item_status', 'reservation_id', 'reservation_status', 'completed_at', 'changed'].sort()
  assert.ok(JSON.stringify(Object.keys(response.data).sort()) === JSON.stringify(expectedKeys), `${label}: unexpected mutation result shape`)
  assert.ok(typeof response.data.changed === 'boolean', `${label}: changed must be boolean`)
  assert.ok(['intake', 'available', 'reserved', 'transferred', 'retired'].includes(response.data.item_status), `${label}: invalid item state`)
  for (const key of ['school_id', 'item_id']) {
    assert.ok(typeof response.data[key] === 'string' && /^[0-9a-f-]{36}$/i.test(response.data[key]), `${label}: ${key} must be a UUID`)
  }
  return response.data
}

export function clothingDetails(overrides = {}) {
  return {
    title: `${runLabel} shirt`, condition: 'good', garment_type: 'shirt', size_system: 'letter',
    size_label: 'M', color_variant: 'Navy', measurements: null, measurement_unit: null, ...overrides,
  }
}

export function textbookDetails(overrides = {}) {
  return {
    title: `${runLabel} textbook`, condition: 'good', isbn13: '9780131103627', edition: '2nd',
    book_format: 'Paperback', course_label: 'QA course', book_term_label: 'Demo term',
    requires_digital_code: false, is_consumable: false, ...overrides,
  }
}

export class DemoApi {
  constructor(config) {
    this.config = config
  }

  async request(actor, path, { method = 'GET', body, query, headers = {} } = {}) {
    const url = new URL(path, this.config.url)
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, String(value))
    const requestHeaders = { apikey: this.config.key, ...headers }
    if (actor) requestHeaders.Authorization = `Bearer ${actor.accessToken}`
    if (body !== undefined) requestHeaders['Content-Type'] = 'application/json'
    let response
    try {
      response = await fetch(url, {
        method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      })
    } catch {
      throw new Error('Demo API request failed or timed out; verify network access and project readiness')
    }
    const text = await response.text()
    let data = null
    if (text) {
      try { data = JSON.parse(text) } catch { throw new Error(`Demo API returned a non-JSON response (HTTP ${response.status})`) }
    }
    return { ok: response.ok, status: response.status, data }
  }

  async login(name) {
    const response = await this.request(null, '/auth/v1/token', {
      method: 'POST', query: { grant_type: 'password' },
      body: { email: process.env[`DEMO_${name}_EMAIL`], password: process.env[`DEMO_${name}_PASSWORD`] },
    })
    assert.ok(response.ok, `Login failed for ${name} (HTTP ${response.status}; ${safeCode(response)})`)
    assert.ok(typeof response.data?.access_token === 'string' && typeof response.data?.refresh_token === 'string' && typeof response.data?.user?.id === 'string', `Login response for ${name} lacks a session`)
    return { name, userId: response.data.user.id, accessToken: response.data.access_token, refreshToken: response.data.refresh_token }
  }

  rpc(actor, name, args) {
    return this.request(actor, `/rest/v1/rpc/${name}`, {
      method: 'POST', body: args, headers: { Accept: 'application/vnd.pgrst.object+json' },
    })
  }

  read(actor, table, query = {}) {
    return this.request(actor, `/rest/v1/${table}`, { query: { select: '*', ...query } })
  }

  async rows(actor, table, query = {}) {
    const response = await this.read(actor, table, query)
    assert.ok(response.ok, `${table} read failed (${safeCode(response)}; HTTP ${response.status})`)
    assert.ok(Array.isArray(response.data), `${table} read did not return rows`)
    return response.data
  }

  async intake(actor, schoolId, category = 'clothing', overrides = {}, storageCode = `${runLabel}-shelf`) {
    const result = mutation(await this.rpc(actor, 'intake_item', {
      p_school_id: schoolId, p_category: category,
      p_details: category === 'clothing' ? clothingDetails(overrides) : textbookDetails(overrides),
      p_storage_code: storageCode,
    }), 'Manager intake')
    assert.equal(result.item_status, 'intake')
    assert.equal(result.changed, true)
    assert.equal(result.reservation_id, null)
    return result.item_id
  }

  async available(actor, schoolId, category = 'clothing', overrides = {}) {
    const itemId = await this.intake(actor, schoolId, category, overrides)
    const result = mutation(await this.rpc(actor, 'publish_item', { p_item_id: itemId, p_inspection_confirmed: true }), 'Manager publication')
    assert.equal(result.item_status, 'available')
    return itemId
  }

  async snapshot(actor, itemId) {
    const [items, staff, reservations, events] = await Promise.all([
      this.rows(actor, 'items', { id: `eq.${itemId}` }),
      this.rows(actor, 'item_staff', { item_id: `eq.${itemId}` }),
      this.rows(actor, 'reservations', { item_id: `eq.${itemId}`, order: 'id.asc' }),
      this.rows(actor, 'item_events', { item_id: `eq.${itemId}`, order: 'id.asc' }),
    ])
    return JSON.stringify({ items, staff, reservations, events })
  }

  logout(actor) {
    return this.request(actor, '/auth/v1/logout', { method: 'POST', query: { scope: 'local' } })
  }
}
