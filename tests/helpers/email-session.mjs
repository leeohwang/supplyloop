import assert from 'node:assert/strict'
import { open, unlink } from 'node:fs/promises'
import { DemoApi, readTestConfig, safeCode } from './supabase.mjs'
import { assertRecentEmailOtp, privateLocalPath, readPrivateText } from './otp-session.mjs'

// Explicit operator tool only. Neither API test suite imports or runs this file.
// request sends to one explicitly selected, configured, existing account.
// verify consumes a code supplied privately by that inbox's human owner.
async function main() {
  const [action, ...args] = process.argv.slice(2)
  if (action === '--help' || action === 'help') {
    console.log('request --email <controlled inbox> --send-email')
    console.log('verify --email <controlled inbox> --code-file <owner-only *.local> --session-file <new *.local>')
    console.log('Load .env.test.local and .env.registration.local; DEMO_REGISTRATION_TEST_EMAIL must match --email. Tokens and codes are never printed.')
    return
  }
  assert.ok(action === 'request' || action === 'verify', 'Choose request or verify explicitly; use --help for the private-input recipe')
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index]
    assert.ok(['--email', '--send-email', '--code-file', '--session-file'].includes(name) && !Object.hasOwn(options, name),
      'Unknown or repeated option; use --help')
    if (name === '--send-email') options[name] = true
    else {
      const value = args[++index]
      assert.ok(typeof value === 'string' && !value.startsWith('--'), 'An option value is missing; use --help')
      options[name] = value
    }
  }
  const email = options['--email']?.trim().toLowerCase()
  const allowed = process.env.DEMO_REGISTRATION_TEST_EMAIL?.trim().toLowerCase()
  assert.ok(typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email === allowed,
    '--email must match the explicitly configured controlled DEMO_REGISTRATION_TEST_EMAIL inbox')
  const api = new DemoApi(readTestConfig())
  if (action === 'request') {
    assert.ok(options['--send-email'] === true && !options['--code-file'] && !options['--session-file'],
      'Sending requires request --email <controlled inbox> --send-email, without verification options')
    const response = await api.request(null, '/auth/v1/otp', {
      method: 'POST', body: { email, create_user: false },
    })
    assert.ok(response.ok, `Controlled OTP request failed (${safeCode(response)}; HTTP ${response.status})`)
    console.log('Requested an email code for the selected existing account. No account, membership, or session file was created.')
    return
  }
  assert.ok(!options['--send-email'], 'verify consumes a privately supplied code; it does not send an email')
  const code = (await readPrivateText(options['--code-file'], 'Email code file', 64)).trim()
  assert.ok(/^\d{8}$/.test(code), 'The configured demo requires an eight-digit email code')
  const sessionPath = privateLocalPath(options['--session-file'], 'Session output file')
  let output
  try { output = await open(sessionPath, 'wx', 0o600) } catch { throw new Error('Choose a new session output file; existing files are never overwritten') }
  let saved = false
  try {
    const response = await api.request(null, '/auth/v1/verify', {
      method: 'POST', body: { email, token: code, type: 'email' },
    })
    assert.ok(response.ok, `Controlled OTP verification failed (${safeCode(response)}; HTTP ${response.status})`)
    const session = response.data
    assertRecentEmailOtp(session?.access_token, session?.user, api.config.url)
    await output.writeFile(`${JSON.stringify({ access_token: session.access_token })}\n`, 'utf8')
    saved = true
    console.log('Verified the received code and saved an owner-only ordinary OTP access token. No school enrollment was requested. No token or code was printed.')
  } finally {
    await output.close()
    if (!saved) await unlink(sessionPath)
  }
}

main().catch((error) => {
  // All messages originate in bounded assertions/helpers, never raw Auth errors.
  console.error(error instanceof Error ? error.message : 'Controlled email operation failed')
  process.exitCode = 1
})
