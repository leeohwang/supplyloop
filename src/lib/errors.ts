import type { ApplicationErrorCode } from '../shared/contracts'

const messages: Record<ApplicationErrorCode, string> = {
  AUTH_REQUIRED: 'Your session has ended. Please sign in again.',
  NOT_AUTHORIZED: 'Your account does not have permission to do that.',
  NOT_FOUND: 'That record is no longer available to your account.',
  INVALID_INPUT: 'Check the information you entered and try again.',
  INCOMPLETE_ITEM: 'Complete the item details, storage location, and inspection before publishing.',
  INVALID_STATE: 'This item or reservation has changed. Review its current status and try again.',
  ITEM_UNAVAILABLE: 'Someone else reserved this item, or it is no longer available.',
  CONFLICT: 'The record changed while you were working. Refresh and try again.',
  DEMO_ACCESS_DENIED: 'That demo access code is invalid or unavailable. Ask the organizer for the current private code.',
  SERVER_ERROR: 'We could not complete that request. Please try again.',
  NETWORK_ERROR: 'We could not reach SupplyLoop. Check your connection and try again. If you submitted a change, refresh to check its outcome.',
}

export class AppError extends Error {
  readonly code: ApplicationErrorCode
  constructor(code: ApplicationErrorCode) {
    super(messages[code])
    this.name = 'AppError'
    this.code = code
  }
}

const codes: Record<string, ApplicationErrorCode> = {
  SL001: 'AUTH_REQUIRED', SL002: 'NOT_AUTHORIZED', SL003: 'NOT_FOUND',
  SL004: 'INVALID_INPUT', SL005: 'INCOMPLETE_ITEM', SL006: 'INVALID_STATE',
  SL007: 'ITEM_UNAVAILABLE', SL008: 'CONFLICT', SL009: 'DEMO_ACCESS_DENIED',
  '22P02': 'INVALID_INPUT', '42501': 'NOT_AUTHORIZED', '23505': 'CONFLICT',
  '40P01': 'CONFLICT', '40001': 'CONFLICT', '55P03': 'CONFLICT',
  PGRST301: 'AUTH_REQUIRED', PGRST302: 'AUTH_REQUIRED', PGRST303: 'AUTH_REQUIRED',
  PGRST116: 'SERVER_ERROR',
  bad_jwt: 'AUTH_REQUIRED', jwt_expired: 'AUTH_REQUIRED', invalid_jwt: 'AUTH_REQUIRED',
  session_not_found: 'AUTH_REQUIRED', refresh_token_not_found: 'AUTH_REQUIRED',
  refresh_token_already_used: 'AUTH_REQUIRED', user_not_found: 'AUTH_REQUIRED',
  ECONNREFUSED: 'NETWORK_ERROR', ENOTFOUND: 'NETWORK_ERROR', ETIMEDOUT: 'NETWORK_ERROR',
  ECONNRESET: 'NETWORK_ERROR', NETWORK_ERROR: 'NETWORK_ERROR',
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error instanceof TypeError) return new AppError('NETWORK_ERROR')
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>
    if (typeof value.code === 'string' && Object.hasOwn(codes, value.code)) return new AppError(codes[value.code])
    if (value.status === 401 || value.name === 'AuthSessionMissingError') return new AppError('AUTH_REQUIRED')
    if (value.name === 'AuthRetryableFetchError' || value.name === 'NetworkError') return new AppError('NETWORK_ERROR')
    // PostgREST can represent a failed fetch as a response with no SQLSTATE.
    if ((!value.code || value.code === '') && typeof value.message === 'string'
      && /failed to fetch|fetch failed|network ?error|network request failed|load failed/i.test(value.message)) {
      return new AppError('NETWORK_ERROR')
    }
  }
  return new AppError('SERVER_ERROR')
}
