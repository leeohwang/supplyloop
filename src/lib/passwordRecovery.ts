import type { SupabaseClient } from '@supabase/supabase-js'
import { AppError } from './errors.ts'
import { signOutWithLocalFallback } from './authLifecycle.ts'

export interface RecoveryActor { userId: string; email: string }
export interface PendingPasswordReset { email: string; sentAt: number }
const pendingKey = 'supplyloop:pending-password-reset'

// A convenience hint only. The authenticated session and shared account intent
// determine whether the password form can be shown; this hint grants no access.
export function readPendingPasswordReset(): PendingPasswordReset | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(pendingKey) ?? 'null')
    if (!value || typeof value !== 'object' || !('email' in value) || !('sentAt' in value)) return null
    return typeof value.email === 'string' && value.email.length <= 254
      && typeof value.sentAt === 'number' && Number.isFinite(value.sentAt) && value.sentAt >= 0
      ? { email: value.email, sentAt: Math.min(value.sentAt, Date.now()) } : null
  } catch { return null }
}
export function savePendingPasswordReset(value: PendingPasswordReset) {
  try { sessionStorage.setItem(pendingKey, JSON.stringify(value)) } catch { /* The flow also works without this hint. */ }
}
export function clearPendingPasswordReset() {
  try { sessionStorage.removeItem(pendingKey) } catch { /* No authorization depends on this hint. */ }
}

type RecoveryAuth = Pick<SupabaseClient['auth'], 'getSession' | 'getUser' | 'updateUser' | 'signOut'>
function matches(user: { id: string; email?: string } | null, actor: RecoveryActor) {
  return user?.id === actor.userId && user.email?.toLowerCase() === actor.email.toLowerCase()
}

// Called inside the complete shared reset action. No session tokens or password
// values leave the SDK call or enter application storage/logs.
export async function finishPasswordRecovery(auth: RecoveryAuth, actor: RecoveryActor, password: string, options: {
  assertCurrent: () => void; removeSession: () => void
}): Promise<{ localOnly: boolean }> {
  if (password.length < 12) throw Object.assign(new Error('Choose a password with at least 12 characters.'), { code: 'weak_password' })
  const { data: stored, error: sessionError } = await auth.getSession()
  if (sessionError) throw sessionError
  if (!matches(stored.session?.user ?? null, actor)) throw new AppError('AUTH_REQUIRED')
  const { data: live, error: userError } = await auth.getUser()
  if (userError) throw userError
  if (!matches(live.user, actor)) throw new AppError('AUTH_REQUIRED')
  options.assertCurrent()
  const { data, error } = await auth.updateUser({ password })
  if (error) throw error
  if (!matches(data.user, actor)) throw new AppError('AUTH_REQUIRED')
  options.assertCurrent()
  return signOutWithLocalFallback({
    signOut: () => auth.signOut({ scope: 'global' }),
    assertCurrent: options.assertCurrent,
    removeSession: options.removeSession,
  })
}
