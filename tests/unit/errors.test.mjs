import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { AppError, normalizeError } from '../../src/lib/errors.ts'

// Node 22.20 strips erasable TypeScript without a transpiler. No browser/backend is required.
// Official runtime documentation checked 2026-10-18:
// https://nodejs.org/download/release/v22.20.0/docs/api/typescript.html
const sensitive = 'PRIVATE_SQL_ROW_TOKEN_DO_NOT_DISPLAY'

function expectSafe(input, expectedCode) {
  const result = normalizeError(input)
  assert.ok(result instanceof AppError && result instanceof Error, 'Normalizer must return an AppError')
  assert.equal(result.code, expectedCode)
  assert.ok(typeof result.message === 'string' && result.message.length > 0, 'A safe user-facing message is required')
  assert.ok(!String(result).includes(sensitive) && !JSON.stringify(result).includes(sensitive), 'Backend details or credentials leaked into the public error')
  assert.ok(!('details' in result) && !('hint' in result) && !('cause' in result), 'Raw backend metadata must not survive normalization')
  return result
}

describe('Error transport boundaries', () => {
  const domainCases = {
    SL001: 'AUTH_REQUIRED', SL002: 'NOT_AUTHORIZED', SL003: 'NOT_FOUND',
    SL004: 'INVALID_INPUT', SL005: 'INCOMPLETE_ITEM', SL006: 'INVALID_STATE',
    SL007: 'ITEM_UNAVAILABLE', SL008: 'CONFLICT', SL009: 'DEMO_ACCESS_DENIED',
  }
  for (const [code, expected] of Object.entries(domainCases)) {
    test(`${code} maps by SQLSTATE and ignores raw text/HTTP status`, () => {
      const first = expectSafe({ code, message: sensitive, details: sensitive, hint: sensitive, status: 400 }, expected)
      const second = expectSafe({ code, message: 'different backend prose', status: 500 }, expected)
      assert.equal(first.message, second.message, 'SQLSTATE mappings must not parse or expose backend prose')
    })
  }

  test('an existing safe AppError retains identity', () => {
    const original = new AppError('ITEM_UNAVAILABLE')
    assert.equal(normalizeError(original), original)
  })

  test('malformed identifiers and insufficient privilege use safe application failures', () => {
    expectSafe({ code: '22P02', message: sensitive, details: sensitive }, 'INVALID_INPUT')
    expectSafe({ code: '42501', message: sensitive, hint: sensitive }, 'NOT_AUTHORIZED')
  })

  test('transaction conflicts require retry/refetch without leaking constraint names', () => {
    for (const code of ['23505', '40P01', '40001', '55P03']) {
      expectSafe({ code, message: sensitive, details: sensitive, hint: sensitive }, 'CONFLICT')
    }
  })

  test('invalid and expired JWT/session errors require sign-in', () => {
    for (const code of ['PGRST301', 'PGRST302', 'PGRST303', 'bad_jwt', 'invalid_jwt', 'jwt_expired', 'session_not_found', 'refresh_token_not_found']) {
      expectSafe({ code, message: sensitive }, 'AUTH_REQUIRED')
    }
    expectSafe({ status: 401, message: sensitive }, 'AUTH_REQUIRED')
    expectSafe({ name: 'AuthSessionMissingError', message: sensitive }, 'AUTH_REQUIRED')
  })

  test('native and wrapped transport failures remain distinct from database failures', () => {
    expectSafe(new TypeError(sensitive), 'NETWORK_ERROR')
    for (const code of ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET']) {
      expectSafe({ code, message: sensitive }, 'NETWORK_ERROR')
    }
    expectSafe({ name: 'AuthRetryableFetchError', message: sensitive }, 'NETWORK_ERROR')
    expectSafe({ code: '', message: `TypeError: Failed to fetch ${sensitive}`, details: sensitive }, 'NETWORK_ERROR')
    expectSafe({ code: 'XX000', message: `failed to fetch ${sensitive}` }, 'SERVER_ERROR')
  })

  test('cardinality and unknown backend defects are never treated as successful or input failures', () => {
    for (const input of [
      { code: 'PGRST116', message: sensitive },
      { code: 'XX000', message: sensitive, details: sensitive, hint: sensitive },
      { code: 'UNRECOGNIZED', status: 500, message: sensitive },
      new Error(sensitive), { message: sensitive }, { code: 42, message: sensitive },
      sensitive, null, undefined,
    ]) expectSafe(input, 'SERVER_ERROR')
  })

  test('prototype property names in untrusted error codes cannot bypass the allowlist', () => {
    for (const code of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expectSafe({ code, message: sensitive, hint: sensitive }, 'SERVER_ERROR')
    }
  })
})
