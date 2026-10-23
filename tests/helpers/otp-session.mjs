import assert from 'node:assert/strict'
import { lstat, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

// These checks keep a supplied test credential out of arguments, source, and
// ordinary-readable files. They do not verify a JWT signature: Auth and the
// Data API still authenticate every request made with the supplied token.
export function privateLocalPath(value, label) {
  assert.ok(typeof value === 'string' && value.endsWith('.local'), `${label} must be an ignored *.local file`)
  const path = resolve(value)
  assert.ok(dirname(path) === process.cwd(), `${label} must be directly inside the project root`)
  return path
}

export async function readPrivateText(value, label, maxBytes = 65_536) {
  const path = privateLocalPath(value, label)
  let info
  try { info = await lstat(path) } catch { throw new Error(`${label} is unavailable; create the owner-only local file first`) }
  assert.ok(info.isFile() && !info.isSymbolicLink(), `${label} must be a regular file, not a link`)
  assert.ok((info.mode & 0o077) === 0, `${label} must have owner-only permissions (chmod 600)`)
  assert.ok(typeof process.getuid !== 'function' || info.uid === process.getuid(), `${label} must belong to the current operator`)
  assert.ok(info.size > 0 && info.size <= maxBytes, `${label} has an invalid size`)
  try { return await readFile(path, 'utf8') } catch { throw new Error(`${label} could not be read`) }
}

export function tokenClaims(accessToken) {
  assert.ok(typeof accessToken === 'string' && accessToken.length > 0, 'Supply an ordinary Auth access token in the private session file')
  const parts = accessToken.split('.')
  assert.ok(parts.length === 3, 'The private session file must contain a JWT access token')
  let claims
  try { claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) } catch { throw new Error('The supplied access token has an unreadable claims payload') }
  assert.ok(claims && typeof claims === 'object' && !Array.isArray(claims), 'The supplied access token has an invalid claims payload')
  return claims
}

export async function readOtpSession(value) {
  const text = await readPrivateText(value, 'DEMO_REGISTRATION_SESSION_FILE')
  let session
  try { session = JSON.parse(text) } catch { throw new Error('The private session file must contain JSON with an access_token field') }
  assert.ok(session && typeof session === 'object' && !Array.isArray(session)
    && Object.keys(session).length === 1 && typeof session.access_token === 'string',
  'Export only {"access_token":"..."}; do not include passwords, email codes, or refresh tokens')
  const claims = tokenClaims(session.access_token)
  return { name: 'CONTROLLED_EMAIL_STUDENT', userId: claims.sub, accessToken: session.access_token }
}

export function assertRecentEmailOtp(accessToken, user, projectUrl) {
  const claims = tokenClaims(accessToken)
  const now = Math.floor(Date.now() / 1000)
  assert.ok(user && typeof user.id === 'string' && claims.sub === user.id, 'Auth must authenticate the supplied session actor')
  assert.ok(claims.iss === `${projectUrl}/auth/v1` && claims.role === 'authenticated', 'Supply a normal user session for the configured demo project')
  assert.ok(user.is_anonymous === false && claims.is_anonymous === false, 'The controlled session must identify a non-anonymous email account')
  assert.ok(typeof user.email === 'string' && user.email.length > 0 && claims.email === user.email,
    'The signed session email must match the live Auth email')
  assert.ok(Number.isFinite(Date.parse(user.email_confirmed_at)), 'The controlled account must have a live confirmed email')
  assert.ok([null, undefined, ''].includes(user.phone) && claims.phone === '',
    'Use an email-only account for the email enrollment fixture')
  assert.ok(typeof claims.exp === 'number' && claims.exp > now + 180,
    'Obtain a fresh OTP session with at least three minutes of access-token validity')
  assert.ok(Array.isArray(claims.amr) && claims.amr.some((method) => method?.method === 'otp'
    && Number.isInteger(method.timestamp) && method.timestamp <= now + 60 && now - method.timestamp <= 3_000),
  'Verify a received email code first; the test fixture needs an OTP AMR less than 50 minutes old')
  return claims
}
