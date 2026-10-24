import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { createAuthLifecycle, AuthCoordinationUnavailable, AuthRecoveryRequired, isPasswordRecoveryKind, signOutWithLocalFallback } from './authLifecycle'
import type { AuthActionKind } from './authLifecycle'
import { AppError } from './errors'
import { finishPasswordRecovery } from './passwordRecovery'
import type { RecoveryActor } from './passwordRecovery'

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''

function validateConfiguration(): string | null {
  if (!projectUrl || !publishableKey) {
    return 'Add the project URL and publishable key to .env.local to connect SupplyLoop.'
  }
  try {
    const url = new URL(projectUrl)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
      return 'Use the Supabase HTTPS project URL, or a localhost development URL.'
    }
  } catch {
    return 'The Supabase project URL is invalid.'
  }
  if (!publishableKey.startsWith('sb_publishable_')) {
    return 'Use a Supabase publishable key. Server-only secret keys cannot be used in this app.'
  }
  return null
}

export const configurationError = validateConfiguration()
const storageKey = configurationError ? '' : `sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`
let sharedStorage: Storage | null = null
try { sharedStorage = window.localStorage } catch { /* Explicit auth actions fail closed without shared storage. */ }
const lifecycle = createAuthLifecycle({
  scope: storageKey, authUrl: configurationError ? 'https://invalid.local/auth/v1' : `${projectUrl.replace(/\/$/, '')}/auth/v1`,
  storage: sharedStorage,
  withLock: typeof navigator !== 'undefined' && navigator.locks ? (name, signal, work) => navigator.locks.request(name, { mode: 'exclusive', signal }, work) : null,
  subscribeStorage: typeof window === 'undefined' ? null : listener => {
    const onStorage = (event: StorageEvent) => listener(event.key)
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  },
  fetch: (input, init) => fetch(input, init),
})
export const supabase = configurationError ? null : createClient<Database>(projectUrl, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey },
  global: { fetch: lifecycle.fetch },
})

export const acceptAuthEvent = lifecycle.acceptEvent
export const subscribeAuthTransition = lifecycle.subscribe
export const authRecoveryRequired = lifecycle.needsRecovery
export const authContext = lifecycle.context
export const authActionKind = lifecycle.currentKind

export async function requestPasswordRecovery(email: string) {
  return authSessionAction('recover-request', null, async db => {
    const { error } = await db.auth.resetPasswordForEmail(email)
    if (error) throw error
  })
}

export async function verifyPasswordRecovery(email: string, token: string) {
  return authSessionAction('recover', null, async db => {
    const { data, error } = await db.auth.verifyOtp({ email, token, type: 'recovery' })
    if (error) throw error
    if (!data.session || !data.user || data.user.email?.toLowerCase() !== email.toLowerCase()) throw new AppError('AUTH_REQUIRED')
  })
}

export async function updateRecoveredPassword(actor: RecoveryActor, context: string | null | undefined, password: string) {
  if (!context || context !== lifecycle.context() || !isPasswordRecoveryKind(lifecycle.currentKind())) throw new AppError('AUTH_REQUIRED')
  return authSessionAction('reset', actor, async db => {
    const result = await finishPasswordRecovery(db.auth, actor, password, {
      assertCurrent: lifecycle.assertCurrent,
      removeSession: () => { if (!sharedStorage) throw new AuthRecoveryRequired(); sharedStorage.removeItem(storageKey) },
    })
    return { ...result, context: lifecycle.context() }
  })
}

export async function signOutAccount() {
  return authSessionAction('signout', null, db => signOutWithLocalFallback({
    signOut: () => db.auth.signOut({ scope: 'local' }),
    assertCurrent: lifecycle.assertLocalSignout,
    removeSession: () => { if (!sharedStorage) throw new AuthRecoveryRequired(); sharedStorage.removeItem(storageKey) },
  }))
}

export async function authSessionAction<T>(kind: AuthActionKind, actor: { userId: string; email: string } | null, work: (client: NonNullable<typeof supabase>) => Promise<T>): Promise<T> {
  const db = supabase
  if (!db) throw new AuthCoordinationUnavailable()
  return lifecycle.run(kind, async () => {
    if (kind === 'signout') return work(db)
    const { data, error } = await db.auth.getSession()
    if (error) throw error
    if (actor) {
      if (!data.session || data.session.user.id !== actor.userId || data.session.user.email?.toLowerCase() !== actor.email.toLowerCase()) throw new AppError('AUTH_REQUIRED')
    } else if (data.session) {
      // A latest guest intent supersedes an older call that crossed its save
      // boundary while this action waited for the application lock.
      const { error: failure } = await db.auth.signOut({ scope: 'local' })
      if (failure) throw new AuthRecoveryRequired()
    }
    return work(db)
  })
}
