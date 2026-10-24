import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { createAuthLifecycle, isPasswordRecoveryKind, signOutWithLocalFallback } from '../../src/lib/authLifecycle.ts'
import { finishPasswordRecovery } from '../../src/lib/passwordRecovery.ts'

// Actual pinned Supabase JS 2.118.0; all transport/storage/locks below are fake.
// There is no native fetch fallback, credential file, inbox, or hosted request.
// Official Node 22.20/test and SDK implementation rechecked 2026-10-23.
const origin = 'https://auth-unit.invalid'
const authUrl = `${origin}/auth/v1`
const actors = {
  A: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@auth-unit.invalid' },
  B: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'b@auth-unit.invalid' },
}
let fixtureNumber = 0

function deferred() {
  let resolve
  let reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

const tick = () => new Promise(resolve => setImmediate(resolve))
const abortError = () => new DOMException('Fake request aborted', 'AbortError')
const capture = promise => promise.then(value => ({ value }), error => ({ error }))

function fakeLocks() {
  const names = new Map()
  return async (name, signal, work) => new Promise((resolve, reject) => {
    const state = names.get(name) ?? { held: false, queue: [] }
    names.set(name, state)
    const entry = { signal, work, resolve, reject, active: false, aborted: false }
    const abort = () => {
      if (entry.active) return // Web Lock signals cancel acquisition, not work.
      entry.aborted = true
      reject(abortError())
    }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    state.queue.push(entry)
    const drain = () => {
      if (state.held) return
      let next
      while ((next = state.queue.shift())) {
        if (next.aborted || next.signal.aborted) continue
        state.held = true
        next.active = true
        Promise.resolve().then(next.work).then(next.resolve, next.reject).finally(() => {
          next.signal.removeEventListener('abort', next.abort)
          state.held = false
          drain()
        })
        break
      }
    }
    entry.abort = abort
    drain()
  })
}

function sharedStorage() {
  const values = new Map()
  const listeners = new Map()
  function view(tab) {
    const announce = key => {
      for (const [owner, callbacks] of listeners) {
        if (owner !== tab) for (const callback of callbacks) queueMicrotask(() => callback(key))
      }
    }
    return {
      getItem: key => values.get(key) ?? null,
      setItem(key, value) { values.set(key, value); announce(key) },
      removeItem(key) { values.delete(key); announce(key) },
    }
  }
  function subscribe(tab, callback) {
    const callbacks = listeners.get(tab) ?? new Set()
    listeners.set(tab, callbacks)
    callbacks.add(callback)
    return () => callbacks.delete(callback)
  }
  return { values, view, subscribe }
}

function gate(stage = 'fetch', ignoreAbort = false) {
  return { stage, ignoreAbort, entered: deferred(), released: deferred(), aborted: deferred() }
}

async function waitAtGate(barrier, signal) {
  barrier.entered.resolve()
  const aborted = deferred()
  const cancel = () => {
    barrier.aborted.resolve()
    aborted.reject(abortError())
  }
  // Attach a rejection consumer even when deliberately simulating a transport
  // which ignores abort; the lifecycle wrapper must still reject its response.
  void aborted.promise.catch(() => {})
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
  try {
    if (barrier.ignoreAbort) await barrier.released.promise
    else await Promise.race([barrier.released.promise, aborted.promise])
  } finally { signal?.removeEventListener('abort', cancel) }
}

function fixture({ initial = null, timeoutMs = 2_000, guarded = true, signupSession = false, strictRecovery = false } = {}) {
  const scope = `qa-auth-lifecycle-${++fixtureNumber}`
  const shared = sharedStorage()
  const withLock = fakeLocks()
  const tabs = []
  const calls = []
  const delays = []
  const failures = []
  const passwordCommits = []
  const refreshes = new Map()
  let tokenNumber = 0
  let intentNumber = 0
  let refreshRejected = false
  let recoveryUsed = false
  let nextUser = null

  function session(actor, method = 'otp') {
    const user = { ...actors[actor], aud: 'authenticated', role: 'authenticated',
      email_confirmed_at: '2026-01-01T00:00:00Z', phone: '', is_anonymous: false,
      app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {} }
    const now = Math.floor(Date.now() / 1000)
    const claims = { iss: authUrl, sub: user.id, aud: 'authenticated', role: 'authenticated',
      email: user.email, phone: '', is_anonymous: false, exp: now + 3600, iat: now,
      session_id: `fake-session-${++tokenNumber}`, amr: [{ method, timestamp: now }] }
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
    const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.c2lnbmF0dXJl`
    const result = { access_token, refresh_token: `fake-refresh-${actor}-${tokenNumber}`,
      expires_in: 3600, expires_at: now + 3600, token_type: 'bearer', user }
    refreshes.set(result.refresh_token, { actor, method })
    return result
  }

  const initialSession = initial ? session(initial, 'password') : null
  if (initialSession) shared.values.set(scope, JSON.stringify(initialSession))

  async function transport(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url)
    assert.ok(url.origin === origin, 'Fake transport must never contact another origin')
    const path = url.pathname.replace('/auth/v1/', '')
    const grant = url.searchParams.get('grant_type')
    const method = init.method ?? 'GET'
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : {}
    calls.push({ path, grant, method, verificationType: body.type ?? null,
      scope: url.searchParams.get('scope'), redirectTo: url.searchParams.get('redirect_to') }) // Routing only, never passwords or codes.
    const actor = body.email === actors.B.email ? 'B' : 'A'
    let data
    let status = 200
    const failureIndex = failures.findIndex(value => value.path === path && (!value.method || value.method === method))
    const failure = failureIndex >= 0 ? failures.splice(failureIndex, 1)[0] : null
    if (failure) { status = failure.status; data = { code: failure.code, msg: 'Fabricated Auth rejection' } }
    else if (path === 'verify') {
      if (strictRecovery && (body.type !== 'recovery' || body.token !== '87654321' || recoveryUsed)) {
        status = 403; data = { code: 'otp_expired', msg: 'Fabricated invalid or used code' }
      } else { if (strictRecovery) recoveryUsed = true; data = session(actor) }
    }
    else if (path === 'recover') data = {}
    else if (path === 'token' && grant === 'password') data = session(actor, 'password')
    else if (path === 'token' && grant === 'refresh_token') {
      const previous = refreshes.get(body.refresh_token)
      assert.ok(previous, 'Refresh must use a session created by this fake server')
      if (refreshRejected) {
        status = 400
        data = { error: 'invalid_grant', error_description: 'Fake refresh rejected' }
      } else data = session(previous.actor, previous.method)
    } else if (path === 'signup') data = signupSession ? session(actor, 'password') : { ...actors[actor], is_anonymous: false, identities: [] }
    else if (path === 'logout') { data = null; status = 204 }
    else if (path === 'user') {
      const bearer = new Headers(init.headers).get('Authorization')?.replace(/^Bearer /, '')
      const payload = JSON.parse(Buffer.from(bearer.split('.')[1], 'base64url').toString())
      const authorizedActor = payload.sub === actors.B.id ? 'B' : 'A'
      const replyActor = method === 'GET' && nextUser ? nextUser : authorizedActor
      if (method === 'GET') nextUser = null
      if (method === 'PUT' && body.password !== undefined) passwordCommits.push(actors[authorizedActor].id)
      data = { ...actors[replyActor], is_anonymous: false }
    } else throw new Error('Unexpected fake Auth route; native networking is prohibited')
    const index = delays.findIndex(delay => delay.path === path && (!delay.grant || delay.grant === grant) && (!delay.method || delay.method === method))
    const delay = index >= 0 ? delays.splice(index, 1)[0] : null
    if (delay?.barrier.stage === 'fetch') await waitAtGate(delay.barrier, init.signal)
    const response = new Response(status === 204 ? null : JSON.stringify(data), {
      status, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
    })
    if (delay?.barrier.stage === 'body') {
      const read = response.json.bind(response)
      response.json = async () => { await waitAtGate(delay.barrier, init.signal); return read() }
    }
    return response
  }

  async function tab(name, overrides = {}) {
    const store = shared.view(name)
    const pending = []
    let writeBarrier = null
    const lifecycle = guarded ? createAuthLifecycle({ scope, authUrl, storage: store, withLock,
      subscribeStorage: callback => shared.subscribe(name, callback), fetch: transport,
      timeoutMs, randomId: () => `fake-intent-${++intentNumber}`, ...overrides,
    }) : { run: (_kind, work) => work(), fetch: transport, acceptEvent: () => true,
      subscribe: callback => { callback(false); return () => {} }, needsRecovery: () => false }
    const storage = {
      getItem: key => store.getItem(key),
      async setItem(key, value) {
        if (key === scope && writeBarrier) {
          const barrier = writeBarrier
          writeBarrier = null
          barrier.entered.resolve()
          await barrier.released.promise
        }
        store.setItem(key, value)
      },
      removeItem: key => store.removeItem(key),
    }
    const client = createClient(origin, 'sb_publishable_fake_unit_key', {
      auth: { storageKey: scope, storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: lifecycle.fetch },
    })
    await client.auth.getSession()
    const seen = []
    const accepted = []
    const { data: { subscription } } = client.auth.onAuthStateChange((event, next) => {
      seen.push({ event, actor: next?.user.id ?? null })
      if (lifecycle.acceptEvent(event, next)) accepted.push({ event, actor: next?.user.id ?? null })
    })
    const unsubscribe = lifecycle.subscribe(value => pending.push(value))
    const result = { client, lifecycle, store, pending, seen, accepted, scope,
      pauseNextWrite() { writeBarrier = gate('storage'); return writeBarrier },
      close: async () => { unsubscribe(); subscription.unsubscribe(); await client.auth.dispose() },
    }
    tabs.push(result)
    await tick()
    return result
  }

  return { scope, shared, tab, calls, initialSession, passwordCommits,
    rejectRefresh() { refreshRejected = true },
    failNext(path, code, status = 400, method = null) { failures.push({ path, code, status, method }) },
    replyNextUser(actor) { nextUser = actor },
    delay(path, stage = 'fetch', ignoreAbort = false, grant = null, method = null) {
      const barrier = gate(stage, ignoreAbort)
      delays.push({ path, barrier, grant, method })
      return barrier
    },
    stored() { const value = shared.values.get(scope); return value ? JSON.parse(value) : null },
    close: async () => { await Promise.all(tabs.map(value => value.close())) },
  }
}

async function requireSuccess(promise) {
  const result = await promise
  if (result.error) throw result.error
  return result
}

// The real adapter must keep these public SDK calls inside the same run lock.
// Guest actions explicitly clear any older provisional session before proceeding;
// a confirmation-required signup then intentionally returns no session.
function signIn(tab, actor = 'B') {
  return tab.lifecycle.run('signin', async () => {
    await requireSuccess(tab.client.auth.signOut({ scope: 'local' }))
    return requireSuccess(tab.client.auth.signInWithPassword({ email: actors[actor].email, password: 'fake-unit-password' }))
  })
}

function verify(tab, actor = 'A') {
  return tab.lifecycle.run('verify', () => requireSuccess(tab.client.auth.verifyOtp({
    email: actors[actor].email, token: '12345678', type: 'email',
  })))
}

function signOut(tab) {
  return tab.lifecycle.run('signout', () => requireSuccess(tab.client.auth.signOut({ scope: 'local' })))
}

function signUp(tab, actor = 'B') {
  return tab.lifecycle.run('signup', async () => {
    await requireSuccess(tab.client.auth.signOut({ scope: 'local' }))
    return requireSuccess(tab.client.auth.signUp({ email: actors[actor].email, password: 'fake-unit-password' }))
  })
}

function requestRecovery(tab, email = actors.A.email) {
  return tab.lifecycle.run('recover-request', async () => {
    await requireSuccess(tab.client.auth.signOut({ scope: 'local' }))
    return requireSuccess(tab.client.auth.resetPasswordForEmail(email))
  })
}

function recover(tab, actor = 'A', token = '87654321', type = 'recovery') {
  return tab.lifecycle.run('recover', async () => {
    await requireSuccess(tab.client.auth.signOut({ scope: 'local' }))
    return requireSuccess(tab.client.auth.verifyOtp({ email: actors[actor].email, token, type }))
  })
}

function resetPassword(tab, actor = 'A', password = 'fabricated-new-password-12', removeSession = () => tab.store.removeItem(tab.scope)) {
  return tab.lifecycle.run('reset', () => finishPasswordRecovery(tab.client.auth, {
    userId: actors[actor].id, email: actors[actor].email,
  }, password, { assertCurrent: tab.lifecycle.assertCurrent, removeSession }))
}

test('control: unguarded pinned SDK restores a late OTP session after sign-out', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A', guarded: false })
  t.after(env.close)
  const a = await env.tab('A')
  const b = await env.tab('B')
  const delayed = env.delay('verify')
  const old = capture(verify(a))
  await delayed.entered.promise
  await signOut(b)
  assert.equal(env.stored(), null)
  delayed.released.resolve()
  assert.ok(!(await old).error)
  // This is the observed incorrect baseline, not the desired application result.
  assert.equal(env.stored()?.user.id, actors.A.id, 'Control must expose the old SDK commit race')
})

for (const stage of ['fetch', 'body']) {
  test(`newer sign-out prevents an older OTP response delayed at ${stage}`, { timeout: 5_000 }, async t => {
    const env = fixture({ initial: 'A' })
    t.after(env.close)
    const a = await env.tab('A')
    const b = await env.tab('B')
    const delayed = env.delay('verify', stage)
    const old = capture(verify(a))
    await delayed.entered.promise
    const latest = capture(signOut(b))
    await delayed.aborted.promise
    delayed.released.resolve()
    assert.ok((await old).error, 'Superseded verification must not report success')
    assert.ok(!(await latest).error, 'The latest sign-out must complete')
    assert.equal(env.stored(), null, 'A late verification must not restore the signed-out account')
    assert.ok(!a.accepted.some(value => value.event === 'SIGNED_IN'), 'Cancelled verification must not reach the accepted UI events')
    assert.equal(b.pending.at(-1), false)
  })
}

for (const kind of ['signin', 'signup']) {
  test(`newer sign-out also cancels an older session-returning ${kind}`, { timeout: 5_000 }, async t => {
    const env = fixture({ initial: 'A', signupSession: true })
    t.after(env.close)
    const a = await env.tab('A')
    const b = await env.tab('B')
    const delayed = env.delay(kind === 'signin' ? 'token' : 'signup', 'fetch', false,
      kind === 'signin' ? 'password' : null)
    const old = capture(kind === 'signin' ? signIn(a, 'A') : signUp(a, 'A'))
    await delayed.entered.promise
    const latest = capture(signOut(b))
    await delayed.aborted.promise
    delayed.released.resolve()
    assert.ok((await old).error)
    assert.ok(!(await latest).error)
    assert.equal(env.stored(), null, 'The older login/signup must not restore an account')
  })
}

for (const stage of ['fetch', 'body']) {
  test(`late ${stage} completion from an abort-ignoring transport cannot restore an account`, { timeout: 5_000 }, async t => {
    const env = fixture({ initial: 'A' })
    t.after(env.close)
    const a = await env.tab('A')
    const b = await env.tab('B')
    const delayed = env.delay('verify', stage, true)
    const old = capture(verify(a))
    await delayed.entered.promise
    const latest = capture(signOut(b))
    await delayed.aborted.promise
    assert.ok((await old).error, 'Cancellation must reach the SDK even when underlying work ignores abort')
    assert.ok(!(await latest).error)
    assert.equal(env.stored(), null)
    delayed.released.resolve()
    await tick()
    assert.equal(env.stored(), null, 'A later underlying response must never reach the SDK session commit')
  })
}

test('newer password sign-in supersedes an OTP request already inside SDK persistence', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A')
  const b = await env.tab('B')
  const saving = a.pauseNextWrite()
  const old = capture(verify(a))
  await saving.entered.promise
  const latest = capture(signIn(b))
  await tick()
  assert.ok(!env.calls.some(value => value.path === 'token' && value.grant === 'password'), 'Later SDK mutations must wait for the first SDK promise to settle')
  saving.released.resolve()
  assert.ok((await old).error, 'The superseded result must not report success')
  assert.ok(!(await latest).error, 'The latest password sign-in must be allowed to replace the intermediate account')
  assert.equal(env.stored()?.user.id, actors.B.id)
  assert.ok(!a.accepted.some(value => value.event === 'SIGNED_IN'), 'Intermediate account A must not be accepted by the UI')
  const snapshot = (await b.client.auth.getSession()).data.session
  assert.ok(b.lifecycle.acceptEvent('INITIAL_SESSION', snapshot), 'A settled authoritative snapshot must be usable')
  assert.ok(!b.lifecycle.acceptEvent('SIGNED_IN', env.initialSession), 'A delayed broadcast for the old token must be ignored')
})

test('newer sign-out clears an OTP session whose SDK save had already begun', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A')
  const b = await env.tab('B')
  const saving = a.pauseNextWrite()
  const old = capture(verify(a))
  await saving.entered.promise
  const latest = capture(signOut(b))
  await tick()
  saving.released.resolve()
  assert.ok((await old).error)
  assert.ok(!(await latest).error)
  assert.equal(env.stored(), null)
  assert.ok(!a.accepted.some(value => value.event === 'SIGNED_IN'))
  assert.equal(b.pending.at(-1), false)
})

test('a newer queued action timing out cannot expose an older SDK save afterward', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A')
  const b = await env.tab('B', { timeoutMs: 30 })
  const saving = a.pauseNextWrite()
  const old = capture(verify(a))
  await saving.entered.promise
  let cleanupStarted = false
  const latest = await capture(b.lifecycle.run('signout', async () => {
    cleanupStarted = true
    return requireSuccess(b.client.auth.signOut({ scope: 'local' }))
  }))
  // A has already reached the SDK storage boundary. B cannot acquire the lock
  // before its deadline and therefore has never cleared that provisional state.
  assert.ok(latest.error)
  assert.equal(cleanupStarted, false)
  saving.released.resolve()
  assert.ok((await old).error)
  const snapshot = (await b.client.auth.getSession()).data.session
  assert.equal(snapshot?.user.id, actors.A.id, 'The older SDK save has committed after B abandoned its cleanup')
  assert.equal(b.lifecycle.acceptEvent('INITIAL_SESSION', snapshot), false, 'The older account must remain hidden after its delayed save')
  assert.equal(b.lifecycle.needsRecovery(), true, 'An abandoned queued action must leave explicit recovery required')
  assert.ok(!a.accepted.some(value => value.event === 'SIGNED_IN'), 'The stale SDK event must not expose account A')
  await signOut(b)
  assert.equal(env.stored(), null)
  assert.equal(b.lifecycle.needsRecovery(), false)
})

test('newer confirmation-required signup leaves no older provisional session stored', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A')
  const b = await env.tab('B')
  const saving = a.pauseNextWrite()
  const old = capture(verify(a))
  await saving.entered.promise
  const latest = capture(signUp(b))
  await tick()
  saving.released.resolve()
  assert.ok((await old).error)
  const result = await latest
  assert.ok(!result.error)
  assert.equal(result.value.data.session, null)
  assert.equal(env.stored(), null, 'A no-session signup cannot leave the older account signed in')
  assert.ok(!a.accepted.some(value => value.event === 'SIGNED_IN'))
  assert.equal(b.pending.at(-1), false)
})

test('normal OTP verification and subsequent SDK refresh retain the authenticated session', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A')
  const verified = await verify(a)
  assert.equal(verified.data.user.id, actors.A.id)
  assert.equal(env.stored()?.user.id, actors.A.id)
  assert.ok(a.lifecycle.acceptEvent('INITIAL_SESSION', (await a.client.auth.getSession()).data.session))
  assert.equal(a.pending.at(-1), false)
  const before = env.stored().access_token
  const refreshed = await requireSuccess(a.client.auth.refreshSession())
  assert.equal(refreshed.data.user.id, actors.A.id)
  assert.notEqual(env.stored().access_token, before)
  assert.ok(a.lifecycle.acceptEvent('TOKEN_REFRESHED', refreshed.data.session), 'Normal refresh must not be treated as a cancelled explicit operation')
})

for (const stage of ['fetch', 'body']) {
  test(`ordinary Auth refresh has a transport deadline at ${stage} even when transport ignores abort`, { timeout: 5_000 }, async t => {
    const env = fixture({ initial: 'A' })
    t.after(env.close)
    const a = await env.tab('A', { networkTimeoutMs: 15 })
    const delayed = env.delay('token', stage, true, 'refresh_token')
    // Exercise the exact fetch boundary handed to the SDK without waiting
    // through the SDK's separate 30-second refresh retry policy.
    const response = a.lifecycle.fetch(`${authUrl}/token?grant_type=refresh_token`, {
      method: 'POST', body: JSON.stringify({ refresh_token: env.initialSession.refresh_token }),
    })
    const pending = capture(stage === 'body' ? response.then(value => value.json()) : response)
    await delayed.entered.promise
    const result = await pending
    assert.equal(result.error?.code, 'request_timeout', 'The transport promise visible to the SDK must reject at its own deadline')
    await delayed.aborted.promise
    delayed.released.resolve()
    await tick()
    assert.equal(env.stored()?.access_token, env.initialSession.access_token, 'A late underlying transport result cannot commit a new session')
  })
}

test('a newer account intent does not cancel ordinary SDK refresh transport', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A')
  const b = await env.tab('B')
  const delayed = env.delay('token', 'body', true, 'refresh_token')
  let transportAborted = false
  void delayed.aborted.promise.then(() => { transportAborted = true })
  const refresh = capture(a.client.auth.refreshSession())
  await delayed.entered.promise
  await signOut(b)
  await tick()
  assert.equal(transportAborted, false, 'An unrelated explicit nonce must not abort the SDK refresh request')
  delayed.released.resolve()
  await refresh
  assert.equal(env.stored(), null, 'The SDK must retain ownership of its refresh-versus-signout commit guard')
  assert.equal(b.lifecycle.acceptEvent('INITIAL_SESSION', null), true)
})

test('auth deadline aborts a stalled response body without persisting a session', { timeout: 5_000 }, async t => {
  const env = fixture({ timeoutMs: 30 })
  t.after(env.close)
  const a = await env.tab('A')
  const delayed = env.delay('verify', 'body')
  const result = capture(verify(a))
  await delayed.entered.promise
  await delayed.aborted.promise
  delayed.released.resolve()
  assert.ok((await result).error)
  assert.equal(env.stored(), null)
  assert.equal(a.pending.at(-1), false, 'An aborted request must release the pending UI state')
})

for (const missing of ['storage', 'withLock', 'subscribeStorage']) {
  test(`explicit authentication fails closed when ${missing} is unavailable`, { timeout: 5_000 }, async t => {
    const env = fixture()
    t.after(env.close)
    let invoked = false
    await assert.rejects(async () => {
      const a = await env.tab('A', { [missing]: null })
      await a.lifecycle.run('signin', async () => { invoked = true })
    })
    assert.equal(invoked, false)
    assert.equal(env.calls.length, 0, 'Unsupported explicit auth must not make a request')
  })
}

test('blocked coordination storage fails before invoking an Auth operation', { timeout: 5_000 }, async t => {
  const env = fixture()
  t.after(env.close)
  const a = await env.tab('A', { storage: {
    getItem: () => null,
    setItem: () => { throw new DOMException('Fake storage blocked', 'SecurityError') },
  } })
  let invoked = false
  await assert.rejects(a.lifecycle.run('signin', async () => { invoked = true }))
  assert.equal(invoked, false)
  assert.equal(env.calls.length, 0)
  assert.equal(a.pending.at(-1), false)
})

test('an expired unfinished intent blocks old session recovery until explicit sign-out', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  env.shared.values.set(`${env.scope}:supplyloop-auth-intent`, JSON.stringify({
    id: 'fake-crashed-intent', kind: 'verify', pending: true, expiresAt: Date.now() - 1,
  }))
  const a = await env.tab('A')
  assert.equal(a.lifecycle.needsRecovery(), true)
  assert.equal(a.lifecycle.acceptEvent('INITIAL_SESSION', env.initialSession), false)
  await signOut(a)
  assert.equal(env.stored(), null)
  assert.equal(a.lifecycle.needsRecovery(), false)
  assert.equal(a.pending.at(-1), false)
})

async function expiredSessionWithCachedRefreshFailure(env, tab) {
  // The pinned SDK retains a still-valid access token after a rejected proactive
  // refresh and caches that failure. When it expires during the cooldown, SDK
  // signOut returns the cached session-read error before removing local storage.
  env.rejectRefresh()
  assert.ok((await tab.client.auth.refreshSession()).error)
  assert.ok(env.stored(), 'A failed proactive refresh must leave this fixture session stored')
  tab.store.setItem(env.scope, JSON.stringify({ ...env.stored(), expires_at: Math.floor(Date.now() / 1000) - 1 }))
  const result = await tab.client.auth.signOut({ scope: 'local' })
  assert.ok(result.error, 'This fixture must exercise a genuine SDK session-read failure')
  assert.ok(env.stored(), 'The real SDK has not yet cleared the expired session')
}

test('explicit sign-out can clear an expired session after a real SDK refresh failure', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A')
  await expiredSessionWithCachedRefreshFailure(env, a)
  const unrelatedKey = `${env.scope}:unrelated-setting`
  a.store.setItem(unrelatedKey, 'preserve')
  const result = await a.lifecycle.run('signout', () => signOutWithLocalFallback({
    signOut: () => a.client.auth.signOut({ scope: 'local' }),
    removeSession: () => a.store.removeItem(env.scope),
    assertCurrent: a.lifecycle.assertCurrent,
  }))
  assert.equal(result.localOnly, true, 'The UI must disclose that server revocation was not confirmed')
  assert.equal(env.stored(), null)
  assert.equal(a.store.getItem(unrelatedKey), 'preserve')
  assert.ok(a.seen.some(value => value.event === 'SIGNED_OUT'), 'The second public SDK sign-out must issue its normal notification')
  assert.equal(a.lifecycle.needsRecovery(), false)
  assert.equal(a.lifecycle.acceptEvent('INITIAL_SESSION', null), true)
})

test('failed explicit local sign-out cleanup keeps the expired account masked', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A')
  await expiredSessionWithCachedRefreshFailure(env, a)
  await assert.rejects(a.lifecycle.run('signout', () => signOutWithLocalFallback({
    signOut: () => a.client.auth.signOut({ scope: 'local' }),
    removeSession: () => { throw new DOMException('Fake storage removal blocked', 'SecurityError') },
    assertCurrent: a.lifecycle.assertCurrent,
  })), error => error.code === 'AUTH_RECOVERY_REQUIRED')
  assert.ok(env.stored(), 'Failed local removal must not be reported as a cleared session')
  assert.equal(a.lifecycle.needsRecovery(), true)
  assert.equal(a.lifecycle.acceptEvent('INITIAL_SESSION', env.stored()), false)
})

test('a current explicit sign-out may finish local cleanup after its own deadline', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A', { timeoutMs: 20, networkTimeoutMs: 1_000 })
  const delayed = env.delay('logout', 'fetch', true)
  let localRemoval = false
  const pending = capture(a.lifecycle.run('signout', () => signOutWithLocalFallback({
    signOut: () => a.client.auth.signOut({ scope: 'local' }),
    removeSession: () => { localRemoval = true; a.store.removeItem(env.scope) },
    assertCurrent: a.lifecycle.assertLocalSignout,
  })))
  await delayed.entered.promise
  await delayed.aborted.promise
  const result = await pending
  assert.ok(!result.error, 'The current logout must finish after its SDK request settles at the deadline')
  assert.equal(result.value.localOnly, true)
  assert.equal(localRemoval, true)
  assert.equal(env.stored(), null)
  assert.equal(a.lifecycle.needsRecovery(), false)
  assert.equal(a.lifecycle.acceptEvent('INITIAL_SESSION', null), true)
  delayed.released.resolve()
  await tick()
  assert.equal(env.stored(), null)
})

test('a superseded sign-out cannot use local fallback to clear the newer account', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A')
  const b = await env.tab('B')
  const delayed = env.delay('logout', 'fetch', true)
  let localRemoval = false
  const old = capture(a.lifecycle.run('signout', () => signOutWithLocalFallback({
    signOut: () => a.client.auth.signOut({ scope: 'local' }),
    removeSession: () => { localRemoval = true; a.store.removeItem(env.scope) },
    assertCurrent: a.lifecycle.assertLocalSignout,
  })))
  await delayed.entered.promise
  const latest = capture(signIn(b))
  await delayed.aborted.promise
  assert.equal((await old).error?.code, 'AUTH_SUPERSEDED')
  assert.ok(!(await latest).error)
  assert.equal(localRemoval, false, 'An old nonce must never authorize the configured-session removal callback')
  assert.equal(env.stored()?.user.id, actors.B.id)
  delayed.released.resolve()
  await tick()
  assert.equal(env.stored()?.user.id, actors.B.id)
})

test('recovery requests use the real SDK recover endpoint and return no session for either address fixture', { timeout: 5_000 }, async t => {
  const env = fixture()
  t.after(env.close)
  const a = await env.tab('A')
  const known = await requestRecovery(a)
  const unknown = await requestRecovery(a, 'missing@auth-unit.invalid')
  assert.deepEqual(known.data, unknown.data, 'Fabricated known/unknown successes must have the same neutral result shape')
  assert.equal(env.stored(), null)
  const sends = env.calls.filter(value => value.path === 'recover')
  assert.equal(sends.length, 2)
  assert.ok(sends.every(value => value.method === 'POST'))
  assert.ok(!env.calls.some(value => value.path === 'signup' || value.path === 'otp'), 'Recovery must not create an account or substitute a sign-in OTP request')
  assert.equal(env.passwordCommits.length, 0)
})

test('SDK recovery verification propagates wrong-type, wrong-code and consumed-code denials', { timeout: 5_000 }, async t => {
  // Fake GoTrue protocol responses test SDK/application handling, not hosted
  // token validation. A real one-use recovery email remains a browser check.
  const env = fixture({ strictRecovery: true })
  t.after(env.close)
  const a = await env.tab('A')
  for (const [code, type] of [['87654321', 'email'], ['00000000', 'recovery']]) {
    assert.equal((await capture(recover(a, 'A', code, type))).error?.code, 'otp_expired')
    assert.equal(env.stored(), null, 'A denied recovery response must not create a session')
  }
  const result = await recover(a)
  assert.equal(result.data.user.id, actors.A.id)
  assert.ok(a.seen.some(value => value.event === 'PASSWORD_RECOVERY'))
  await signOut(a)
  assert.equal((await capture(recover(a))).error?.code, 'otp_expired')
  assert.equal(env.stored(), null)
  assert.equal(env.passwordCommits.length, 0)
  assert.equal(env.calls.filter(value => value.path === 'verify').at(-1).verificationType, 'recovery')
})

test('recovery purpose survives SDK refresh and a new tab until coordinated sign-out', { timeout: 5_000 }, async t => {
  const env = fixture({ strictRecovery: true })
  t.after(env.close)
  const a = await env.tab('A')
  await recover(a)
  assert.equal(isPasswordRecoveryKind(a.lifecycle.currentKind()), true)
  assert.equal(a.pending.at(-1), false)
  const b = await env.tab('restored')
  assert.equal((await b.client.auth.getSession()).data.session.user.id, actors.A.id)
  assert.equal(isPasswordRecoveryKind(b.lifecycle.currentKind()), true, 'Restoration must not erase the workspace-masking purpose')
  await requireSuccess(b.client.auth.refreshSession())
  assert.equal(isPasswordRecoveryKind(b.lifecycle.currentKind()), true, 'TOKEN_REFRESHED must not authorize the school workspace during recovery')
  assert.equal(isPasswordRecoveryKind(a.lifecycle.currentKind()), true)
  await signOut(b)
  assert.equal(env.stored(), null)
  assert.equal(isPasswordRecoveryKind(a.lifecycle.currentKind()), false)
  assert.equal(isPasswordRecoveryKind(b.lifecycle.currentKind()), false)
})

for (const stage of ['fetch', 'body']) {
  test(`a newer account action cancels recovery mail transport delayed at ${stage}`, { timeout: 5_000 }, async t => {
    const env = fixture()
    t.after(env.close)
    const a = await env.tab('A')
    const b = await env.tab('B')
    const delayed = env.delay('recover', stage, true)
    const old = capture(requestRecovery(a))
    await delayed.entered.promise
    const latest = capture(signIn(b))
    await delayed.aborted.promise
    assert.equal((await old).error?.code, 'AUTH_SUPERSEDED')
    assert.ok(!(await latest).error)
    assert.equal(env.stored()?.user.id, actors.B.id)
    delayed.released.resolve()
    await tick()
    assert.equal(env.stored()?.user.id, actors.B.id)
    assert.equal(isPasswordRecoveryKind(b.lifecycle.currentKind()), false)
  })
}

test('a late recovery verification save cannot replace the newer password sign-in', { timeout: 5_000 }, async t => {
  const env = fixture({ strictRecovery: true })
  t.after(env.close)
  const a = await env.tab('A')
  const b = await env.tab('B')
  const saving = a.pauseNextWrite()
  const old = capture(recover(a))
  await saving.entered.promise
  const latest = capture(signIn(b))
  await tick()
  assert.ok(!env.calls.some(value => value.path === 'token'), 'The newer account must wait for the entire recovery SDK save')
  saving.released.resolve()
  assert.equal((await old).error?.code, 'AUTH_SUPERSEDED')
  assert.ok(!(await latest).error)
  assert.equal(env.stored()?.user.id, actors.B.id)
  assert.ok(!a.accepted.some(value => value.event === 'PASSWORD_RECOVERY'))
})

test('a newer no-session recovery request clears an older provisional recovery save', { timeout: 5_000 }, async t => {
  const env = fixture({ strictRecovery: true })
  t.after(env.close)
  const a = await env.tab('A')
  const b = await env.tab('B')
  const saving = a.pauseNextWrite()
  const old = capture(recover(a))
  await saving.entered.promise
  const latest = capture(requestRecovery(b))
  await tick()
  saving.released.resolve()
  assert.equal((await old).error?.code, 'AUTH_SUPERSEDED')
  assert.ok(!(await latest).error)
  assert.equal(env.stored(), null, 'A request returning no session cannot expose the previous recovery account')
  assert.equal(b.lifecycle.currentKind(), 'recover-request')
  assert.equal(isPasswordRecoveryKind(b.lifecycle.currentKind()), false)
})

for (const initial of [null, 'B']) {
  test(`password completion refuses ${initial ? 'a different account session' : 'a missing session'} before PUT`, { timeout: 5_000 }, async t => {
    const env = fixture({ initial })
    t.after(env.close)
    const a = await env.tab('A')
    await assert.rejects(resetPassword(a))
    assert.ok(!env.calls.some(value => value.path === 'user' && value.method === 'PUT'))
    assert.equal(env.passwordCommits.length, 0)
    assert.equal(isPasswordRecoveryKind(a.lifecycle.currentKind()), true)
  })
}

test('password completion checks live Auth identity before issuing a password PUT', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A')
  env.replyNextUser('B')
  await assert.rejects(resetPassword(a))
  assert.ok(env.calls.some(value => value.path === 'user' && value.method === 'GET'))
  assert.ok(!env.calls.some(value => value.path === 'user' && value.method === 'PUT'))
  assert.equal(env.passwordCommits.length, 0)
})

test('the twelve-character password minimum is enforced before any Auth request', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A')
  await assert.rejects(resetPassword(a, 'A', '12345678901'))
  assert.equal(env.calls.length, 0)
  assert.equal(env.passwordCommits.length, 0)
  assert.equal(env.stored()?.user.id, actors.A.id)
})

for (const code of ['weak_password', 'same_password']) {
  test(`SDK ${code} denial keeps recovery masked without a password commit or cleanup`, { timeout: 5_000 }, async t => {
    const env = fixture({ initial: 'A' })
    t.after(env.close)
    const a = await env.tab('A')
    env.failNext('user', code, 422, 'PUT')
    assert.equal((await capture(resetPassword(a))).error?.code, code)
    assert.equal(env.passwordCommits.length, 0)
    assert.ok(!env.calls.some(value => value.path === 'logout'))
    assert.equal(env.stored()?.user.id, actors.A.id)
    assert.equal(isPasswordRecoveryKind(a.lifecycle.currentKind()), true)
  })
}

test('successful actual-SDK password completion updates only its actor and signs out globally', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A')
  const result = await resetPassword(a)
  assert.equal(result.localOnly, false)
  assert.deepEqual(env.passwordCommits, [actors.A.id])
  assert.equal(env.calls.filter(value => value.path === 'user' && value.method === 'PUT').length, 1)
  assert.equal(env.calls.find(value => value.path === 'logout')?.scope, 'global')
  assert.ok(a.seen.some(value => value.event === 'USER_UPDATED'))
  assert.ok(a.seen.some(value => value.event === 'SIGNED_OUT'))
  assert.equal(env.stored(), null)
  assert.ok(!JSON.stringify([...env.shared.values]).includes('fabricated-new-password-12'), 'The password must not enter shared storage')
})

for (const stage of ['fetch', 'body']) {
  test(`a later account wins over a password-update response delayed at ${stage}`, { timeout: 5_000 }, async t => {
    const env = fixture({ initial: 'A' })
    t.after(env.close)
    const a = await env.tab('A')
    const b = await env.tab('B')
    const delayed = env.delay('user', stage, true, null, 'PUT')
    const old = capture(resetPassword(a))
    await delayed.entered.promise
    // This fake server has already committed A's update. Cancellation cannot
    // promise to undo it; it must prevent stale session/UI restoration instead.
    assert.deepEqual(env.passwordCommits, [actors.A.id])
    const latest = capture(signIn(b))
    await delayed.aborted.promise
    assert.equal((await old).error?.code, 'AUTH_SUPERSEDED')
    assert.ok(!(await latest).error)
    assert.equal(env.stored()?.user.id, actors.B.id)
    delayed.released.resolve()
    await tick()
    assert.equal(env.stored()?.user.id, actors.B.id)
    assert.deepEqual(env.passwordCommits, [actors.A.id], 'A stale form must never update account B')
    assert.ok(!a.accepted.some(value => value.event === 'USER_UPDATED'))
  })
}

test('a password update already inside SDK persistence cannot restore its account after a newer login', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A')
  const b = await env.tab('B')
  const saving = a.pauseNextWrite()
  const old = capture(resetPassword(a))
  await saving.entered.promise
  const latest = capture(signIn(b))
  await tick()
  assert.ok(!env.calls.some(value => value.path === 'token'), 'A later mutation must wait until SDK updateUser has settled')
  saving.released.resolve()
  assert.equal((await old).error?.code, 'AUTH_SUPERSEDED')
  assert.ok(!(await latest).error)
  assert.equal(env.stored()?.user.id, actors.B.id)
  assert.deepEqual(env.passwordCommits, [actors.A.id])
  assert.ok(!a.accepted.some(value => value.event === 'USER_UPDATED'))
})

test('an uncertain committed password response retains recovery purpose without claiming cleanup', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A', { networkTimeoutMs: 15 })
  const delayed = env.delay('user', 'body', true, null, 'PUT')
  const result = capture(resetPassword(a))
  await delayed.entered.promise
  assert.ok((await result).error)
  assert.deepEqual(env.passwordCommits, [actors.A.id], 'The test must represent a password which may already have changed')
  assert.ok(!env.calls.some(value => value.path === 'logout'), 'An unconfirmed update must not be reported as successful cleanup')
  assert.equal(isPasswordRecoveryKind(a.lifecycle.currentKind()), true)
  assert.equal(env.stored()?.user.id, actors.A.id)
  delayed.released.resolve()
  await tick()
  assert.equal(env.stored()?.user.id, actors.A.id)
})

test('failed global logout after a confirmed update uses explicit local fallback and reports localOnly', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A')
  env.failNext('logout', 'unexpected_failure', 500, 'POST')
  const result = await resetPassword(a)
  assert.equal(result.localOnly, true)
  assert.deepEqual(env.passwordCommits, [actors.A.id])
  assert.equal(env.stored(), null)
  assert.ok(a.seen.some(value => value.event === 'SIGNED_OUT'))
})

test('a failed local removal after password update keeps explicit recovery required', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A')
  env.failNext('logout', 'unexpected_failure', 500, 'POST')
  await assert.rejects(resetPassword(a, 'A', 'fabricated-new-password-12', () => {
    throw new DOMException('Fabricated storage removal failure', 'SecurityError')
  }), error => error.code === 'AUTH_RECOVERY_REQUIRED')
  assert.deepEqual(env.passwordCommits, [actors.A.id])
  assert.equal(a.lifecycle.needsRecovery(), true)
  assert.equal(isPasswordRecoveryKind(a.lifecycle.currentKind()), true)
  assert.equal(a.lifecycle.acceptEvent('INITIAL_SESSION', env.stored()), false)
})

test('password completion cannot borrow the sign-out-only local removal exception after its deadline', { timeout: 5_000 }, async t => {
  const env = fixture({ initial: 'A' })
  t.after(env.close)
  const a = await env.tab('A', { timeoutMs: 30, networkTimeoutMs: 1_000 })
  const delayed = env.delay('logout', 'fetch', true)
  let removed = false
  const pending = capture(resetPassword(a, 'A', 'fabricated-new-password-12', () => {
    removed = true; a.store.removeItem(env.scope)
  }))
  await delayed.entered.promise
  const result = await pending
  assert.ok(result.error)
  assert.equal(removed, false, 'Only an explicit signout intent may clear locally after its own deadline')
  assert.equal(isPasswordRecoveryKind(a.lifecycle.currentKind()), true)
  delayed.released.resolve()
  await tick()
})
