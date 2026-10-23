import { authSessionAction, supabase } from '../../lib/supabase'
import { AppError, normalizeError } from '../../lib/errors'

export const emailCodeLength = 8
export const emailCodeLifetimeSeconds = 3600
export const emailCodeResendSeconds = 60
const pendingKey = 'supplyloop:pending-email-confirmation'

export interface PendingEmailConfirmation { email: string; sentAt: number }
export type EmailCodeRequest = 'signup' | 'existing'

export function readPendingEmail(): PendingEmailConfirmation | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(pendingKey) ?? 'null')
    if (!value || typeof value !== 'object' || !('email' in value) || !('sentAt' in value)) return null
    return typeof value.email === 'string' && value.email.length <= 254
      && typeof value.sentAt === 'number' && Number.isFinite(value.sentAt) && value.sentAt >= 0
      ? { email: value.email, sentAt: Math.min(value.sentAt, Date.now()) } : null
  } catch { return null }
}

export function savePendingEmail(value: PendingEmailConfirmation) {
  try { sessionStorage.setItem(pendingKey, JSON.stringify(value)) } catch { /* Confirmation also works without browser storage. */ }
}

export function clearPendingEmail() {
  try { sessionStorage.removeItem(pendingKey) } catch { /* No private application data depends on this hint. */ }
}

export function authFailureCode(failure: unknown): string | null {
  return failure && typeof failure === 'object' && 'code' in failure && typeof failure.code === 'string' ? failure.code : null
}

export function uncertainAuthFailure(failure: unknown): boolean {
  const normalized = normalizeError(failure)
  const code = authFailureCode(failure)
  return normalized.code === 'NETWORK_ERROR' || (normalized.code === 'SERVER_ERROR'
    && (!code || code === 'unexpected_failure' || code === 'request_timeout'
      || (typeof failure === 'object' && failure !== null && 'status' in failure && typeof failure.status === 'number' && failure.status >= 500)))
}

export function authErrorMessage(failure: unknown, phase: 'signin' | 'signup' | 'verify' | 'send'): string {
  const code = authFailureCode(failure)
  if (code === 'AUTH_COORDINATION_UNAVAILABLE') return 'Use a current browser with cookies and site storage enabled to sign in safely. SupplyLoop requires Web Locks and shared browser storage.'
  if (code === 'AUTH_RECOVERY_REQUIRED') return 'Sign out and retry before changing accounts. We could not safely clear the earlier session.'
  if (code === 'invalid_credentials') return 'Email or password was not recognized. Check your demo account details.'
  if (code === 'weak_password') return 'Choose a password with at least 12 characters and try again.'
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'Check the email address and information you entered, then try again.'
  if (code === 'user_already_exists' || code === 'email_exists') return 'We could not create an account with these details. If you registered before, choose Sign in or finish email confirmation.'
  if (code === 'signup_disabled' || code === 'email_provider_disabled' || code === 'otp_disabled') return 'This account option is unavailable. Use an existing demo login or ask the organizer for help.'
  if (code === 'email_address_not_authorized') return 'Email delivery is unavailable for this address. Ask the organizer to check the sending setup.'
  if (code === 'email_not_confirmed') return 'Confirm your email with the code from your inbox before signing in.'
  if (code === 'otp_expired') return 'That code is invalid, expired, or already used. Enter the latest code or request a new one.'
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') return 'Too many attempts. Wait before trying again. You can still enter a code you already received.'
  const normalized = normalizeError(failure)
  if (normalized.code === 'SERVER_ERROR' || normalized.code === 'NETWORK_ERROR') {
    if (phase === 'signup') return 'We could not confirm whether registration completed. If a code arrives, enter it. Otherwise request another code or try signing in with the same details.'
    if (phase === 'verify') return 'We could not confirm the response. Try signing in with your password before requesting another code; your confirmation may have succeeded.'
    if (phase === 'send') return 'We could not confirm the code request. Check your inbox before requesting another code, or try again after a minute.'
  }
  return normalized.message
}

async function clientForEmail(email: string, userId?: string) {
  if (!supabase) throw new AppError('SERVER_ERROR')
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (userId) {
    if (!data.session || data.session.user.id !== userId || data.session.user.email?.toLowerCase() !== email.toLowerCase()) throw new AppError('AUTH_REQUIRED')
  } else if (data.session) throw new AppError('AUTH_REQUIRED')
  return supabase
}

export async function requestEmailCode(email: string, kind: EmailCodeRequest, userId?: string) {
  const db = await clientForEmail(email, userId)
  if (kind === 'existing' && !userId) throw new AppError('AUTH_REQUIRED')
  const { error } = kind === 'signup'
    ? await db.auth.resend({ type: 'signup', email })
    : await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
  if (error) throw error
}

export async function verifyEmailCode(email: string, token: string, userId?: string) {
  await authSessionAction('verify', userId ? { userId, email } : null, async db => {
    const { data, error } = await db.auth.verifyOtp({ email, token, type: 'email' })
    if (error) throw error
    if (!data.session || !data.user || (userId && data.user.id !== userId)) throw new AppError('AUTH_REQUIRED')
  })
  // The shared auth listener accepts the session; callers only update their form.
}
