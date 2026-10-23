export type AuthActionKind = 'signin' | 'signup' | 'verify' | 'signout'
interface Intent { id: string; kind: AuthActionKind; pending: boolean; expiresAt: number }
interface SharedStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
type WithLock = <T>(name: string, signal: AbortSignal, work: () => Promise<T>) => Promise<T>
interface Options {
  scope: string; authUrl: string; storage: SharedStorage | null; withLock: WithLock | null
  subscribeStorage: ((listener: (key: string | null) => void) => () => void) | null
  fetch: typeof fetch; timeoutMs?: number; networkTimeoutMs?: number; randomId?: () => string
}

export class AuthActionSuperseded extends Error { readonly code = 'AUTH_SUPERSEDED'; constructor() { super('Another account action replaced this request.') } }
export class AuthCoordinationUnavailable extends Error { readonly code = 'AUTH_COORDINATION_UNAVAILABLE'; constructor() { super('Account coordination is unavailable.') } }
export class AuthRecoveryRequired extends Error { readonly code = 'AUTH_RECOVERY_REQUIRED'; constructor() { super('Sign out before retrying this account change.') } }
class AuthActionTimeout extends Error { readonly code = 'request_timeout'; constructor() { super('The account request timed out.') } }

export async function signOutWithLocalFallback(options: {
  signOut: () => Promise<{ error: unknown }>; removeSession: () => void; assertCurrent: () => void
}): Promise<{ localOnly: boolean }> {
  try { const result = await options.signOut(); if (!result.error) return { localOnly: false } } catch { /* A failed session read can also prevent SDK sign-out. */ }
  options.assertCurrent()
  try {
    options.removeSession()
    options.assertCurrent()
    const result = await options.signOut()
    if (result.error) throw new AuthRecoveryRequired()
    return { localOnly: true }
  } catch { throw new AuthRecoveryRequired() }
}

// One lock covers each complete public SDK call, including storage and notifications.
// A nonce alone cannot close the SDK's asynchronous session-save window.
export function createAuthLifecycle(options: Options) {
  const key = `${options.scope}:supplyloop-auth-intent`
  const lockName = `${options.scope}:supplyloop-auth-action`
  const timeoutMs = options.timeoutMs ?? 30000
  const listeners = new Set<(pending: boolean) => void>()
  let active: { intent: Intent; controller: AbortController } | null = null
  let ownPending: Intent | null = null
  let wakeup: ReturnType<typeof setTimeout> | undefined

  function readIntent(): Intent | null {
    const raw = options.storage?.getItem(key)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string'
      || !('kind' in value) || typeof value.kind !== 'string' || !['signin', 'signup', 'verify', 'signout'].includes(value.kind)
      || !('pending' in value) || typeof value.pending !== 'boolean'
      || !('expiresAt' in value) || typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt)) throw new AuthCoordinationUnavailable()
    return value as Intent
  }
  function needsRecovery() {
    try { const intent = readIntent(); return !!intent?.pending && intent.expiresAt <= Date.now() && ownPending?.id !== intent.id } catch { return true }
  }
  function pending() {
    try { const intent = readIntent(); return !!intent?.pending && (intent.expiresAt > Date.now() || ownPending?.id === intent.id) } catch { return false }
  }
  function changed() {
    clearTimeout(wakeup)
    let intent: Intent | null
    try { intent = readIntent() } catch { intent = null }
    if (active && intent?.id !== active.intent.id) active.controller.abort(new AuthActionSuperseded())
    if (intent?.pending && intent.expiresAt > Date.now()) wakeup = setTimeout(changed, intent.expiresAt - Date.now() + 1)
    const value = pending()
    for (const listener of listeners) listener(value)
  }
  options.subscribeStorage?.(changedKey => { if (changedKey === key || changedKey === null) changed() })

  function check(intent: Intent, signal: AbortSignal) {
    if (readIntent()?.id !== intent.id) throw new AuthActionSuperseded()
    if (signal.aborted) throw signal.reason
  }
  function checkLocalRemoval(intent: Intent, signal: AbortSignal) {
    if (intent.kind !== 'signout' || readIntent()?.id !== intent.id) throw new AuthActionSuperseded()
    // Only explicit local removal may finish after its own deadline. A newer
    // intent always wins, and session creation never uses this exception.
    if (signal.aborted && !(signal.reason instanceof AuthActionTimeout)) throw signal.reason
  }
  function guarded<T>(work: Promise<T>, signal: AbortSignal, intent?: Intent): Promise<T> {
    // Cancellation rejects the fetch/body promise seen by the SDK. The enclosing
    // run() still awaits the SDK itself, so it cannot commit after lock release.
    return new Promise((resolve, reject) => {
      void work.catch(() => {})
      const aborted = () => reject(signal.reason)
      signal.addEventListener('abort', aborted, { once: true })
      const validate = () => { if (intent) check(intent, signal); else if (signal.aborted) throw signal.reason }
      try { validate() } catch (failure) { signal.removeEventListener('abort', aborted); reject(failure); return }
      void work.then(value => {
        try { validate(); resolve(value) } catch (failure) { reject(failure) }
      }, reject).finally(() => signal.removeEventListener('abort', aborted))
    })
  }
  const coordinatedFetch: typeof fetch = async (input, init) => {
    const operation = active
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const base = new URL(options.authUrl)
    const path = url.pathname.slice(base.pathname.replace(/\/$/, '').length)
    const authPath = base.pathname.replace(/\/$/, '')
    if (url.origin !== base.origin || !(url.pathname === authPath || url.pathname.startsWith(`${authPath}/`))) return options.fetch(input, init)
    // Refresh/initialization get a finite transport deadline, independently of
    // account intents. Their normal SDK retry and session-commit guards remain.
    const explicitEndpoint = ['verify', 'signup', 'logout'].some(endpoint => path === `/${endpoint}`)
      || (path === '/token' && url.searchParams.get('grant_type') === 'password')
    const intent = explicitEndpoint ? operation?.intent : undefined
    const network = new AbortController()
    const timer = setTimeout(() => network.abort(new AuthActionTimeout()), options.networkTimeoutMs ?? 10000)
    const signals = [network.signal]
    if (init?.signal) signals.push(init.signal)
    if (intent && operation) signals.push(operation.controller.signal)
    const signal = AbortSignal.any(signals)
    let response: Response
    try { response = await guarded(options.fetch(input, { ...init, signal }), signal, intent) }
    catch (failure) { clearTimeout(timer); throw failure }
    if (response.body === null || (path === '/logout' && response.ok)) clearTimeout(timer)
    // Fetch can resolve its headers while its JSON body is still arriving.
    // Guard that public body boundary too, including injected test transports.
    return new Proxy(response, { get(target, property) {
      if (property === 'json') return () => guarded(target.json(), signal, intent).finally(() => clearTimeout(timer))
      const value: unknown = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    } })
  }

  async function run<T>(kind: AuthActionKind, work: () => Promise<T>): Promise<T> {
    if (!options.storage || !options.withLock || !options.subscribeStorage || typeof AbortSignal.any !== 'function') throw new AuthCoordinationUnavailable()
    if (!options.randomId && (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function')) throw new AuthCoordinationUnavailable()
    const intent: Intent = { id: (options.randomId ?? (() => crypto.randomUUID()))(), kind, pending: true, expiresAt: Date.now() + timeoutMs }
    const controller = new AbortController()
    try { options.storage.setItem(key, JSON.stringify(intent)); if (readIntent()?.id !== intent.id) throw new AuthActionSuperseded() }
    catch (failure) { if (failure instanceof AuthActionSuperseded) throw failure; throw new AuthCoordinationUnavailable() }
    ownPending = intent; changed()
    const timer = setTimeout(() => controller.abort(new AuthActionTimeout()), timeoutMs)
    let started = false
    let recoveryRequired = false
    try {
      return await options.withLock(lockName, controller.signal, async () => {
        check(intent, controller.signal)
        started = true
        active = { intent, controller }
        try {
          const result = await work()
          if (kind === 'signout' && result && typeof result === 'object' && 'localOnly' in result && result.localOnly === true) checkLocalRemoval(intent, controller.signal)
          else check(intent, controller.signal)
          return result
        } finally { if (active?.intent.id === intent.id) active = null }
      })
    } catch (failure) {
      if (readIntent()?.id !== intent.id) throw new AuthActionSuperseded()
      recoveryRequired = !started || failure instanceof AuthRecoveryRequired
      if (controller.signal.aborted) throw controller.signal.reason
      throw failure
    } finally {
      clearTimeout(timer)
      if (ownPending?.id === intent.id) ownPending = null
      if (readIntent()?.id === intent.id) options.storage.setItem(key, JSON.stringify({ ...intent, pending: recoveryRequired, expiresAt: recoveryRequired ? Date.now() : intent.expiresAt }))
      changed()
    }
  }

  function acceptEvent(_event: string, session: { access_token: string } | null) {
    try {
      if (pending() || needsRecovery()) return false
      const raw = options.storage?.getItem(options.scope)
      const stored: unknown = raw ? JSON.parse(raw) : null
      return session ? !!stored && typeof stored === 'object' && 'access_token' in stored && stored.access_token === session.access_token : !stored
    } catch { return false }
  }
  return {
    run, fetch: coordinatedFetch, acceptEvent, needsRecovery,
    assertCurrent() { if (!active) throw new AuthActionSuperseded(); check(active.intent, active.controller.signal) },
    assertLocalSignout() { if (!active) throw new AuthActionSuperseded(); checkLocalRemoval(active.intent, active.controller.signal) },
    context() { try { return readIntent()?.id ?? null } catch { return undefined } },
    currentKind() { try { return readIntent()?.kind ?? null } catch { return null } },
    subscribe(listener: (value: boolean) => void) { listeners.add(listener); listener(pending()); return () => { listeners.delete(listener) } },
  }
}
