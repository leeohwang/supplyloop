# Controlled email verification acceptance

The registration API suite no longer creates fake-address accounts or assumes
signup returns a session. It requires a human-controlled, confirmed email
account with no existing school membership and a recent ordinary OTP session.
It never requests signup, sends email, changes the student's password, confirms
an account administratively, or revokes the supplied session. Its five scenarios
retain School A enrollment, fictional QA stock, and pickup/audit history.

## Private inputs and explicit email actions

Use Node 22.20.0 and the existing ignored, owner-only `.env.test.local` and
`.env.registration.local` configuration. Create the separate email-test file:

```sh
cp .env.email-test.example .env.email-test.local
chmod 600 .env.email-test.local
```

Set these values in `.env.email-test.local`, replacing the sample address with
the inbox the human explicitly authorizes:

```text
DEMO_REGISTRATION_TEST_EMAIL=your-controlled@example.org
DEMO_REGISTRATION_SESSION_FILE=.registration-session.private.local
```

Do not put the inbox, email code, password, or session token in tracked files,
screenshots, or logs. The community join code stays in `.env.registration.local`
as `DEMO_REGISTRATION_ACCESS_CODE`; it is unrelated to the emailed authentication
code. All helper commands below load all three private environment files.

The account must already exist from the user-approved browser signup. Stop
before entering the community join code. For an existing unenrolled account,
the optional helper requests an OTP only when the operator explicitly runs:

```sh
node --env-file=.env.test.local --env-file=.env.registration.local --env-file=.env.email-test.local tests/helpers/email-session.mjs request --email 'your-controlled@example.org' --send-email
```

Replace the sample `--email` address with the same inbox configured in
`.env.email-test.local`; the values must match. The helper sends to only that
selected existing account using `create_user: false`; it never creates an
account. Do not run it automatically, repeatedly, or for generated addresses.
An already received browser signup code can be verified without running the
request action.

The inbox owner puts the received eight-digit code in
`.registration-code.private.local` using a private local editor/input, then
sets that file to owner-only permissions. Do not put the code in shell arguments
or chat. Both private input/output files must be regular files directly in the
project root, with `.local` names. The helper refuses symlink inputs and files
readable by other users.

```sh
chmod 600 .registration-code.private.local
node --env-file=.env.test.local --env-file=.env.registration.local --env-file=.env.email-test.local tests/helpers/email-session.mjs verify --email 'your-controlled@example.org' --code-file .registration-code.private.local --session-file .registration-session.private.local
```

`verify` consumes the supplied code without sending another message. It checks
the returned normal user's confirmed email and recent `otp` AMR, then writes
only `{"access_token":"..."}` to a new `0600` session file. It never prints the
token/code, stores a refresh token, or overwrites an existing file. A wrong,
expired, or consumed code fails without producing a usable session file. The
`--session-file` output must match `DEMO_REGISTRATION_SESSION_FILE` in
`.env.email-test.local`. Remove the private code file through trusted local
tooling after the check.

Alternatively, trusted local tooling may export only that JSON access-token
field from an explicitly authorized ordinary OTP session to an owner-only file.
Do not extract hidden browser state, use an operator token, or share the token
through chat. Decoding the token in the test runner is a fixture check; live Auth
and the Data API still validate authentication and authorization.

## Run the five hosted registration scenarios

Run promptly after verification. The input token needs at least three minutes
of remaining lifetime and an `otp` AMR less than 50 minutes old, leaving time
within the backend's one-hour proof window.

```sh
npm run test:registration
```

This loads `.env.test.local`, `.env.registration.local`, and
`.env.email-test.local`. Its equivalent direct command is:

```sh
node --env-file=.env.test.local --env-file=.env.registration.local --env-file=.env.email-test.local --test --test-concurrency=1 tests/api/registration.test.mjs
```

The suite first authenticates the token with `/auth/v1/user`, checks the live
confirmed, non-anonymous email identity against the signed session email, and
requires zero school memberships. Its scenarios cover:

1. Confirmation alone reveals no school rows; anonymous enrollment and private
   registration-state access fail.
2. Wrong community codes, blank labels, and school/role arguments grant nothing.
3. Existing fixed-role accounts cannot be re-enrolled or changed.
4. Editable Auth metadata cannot select a role/school; concurrent enrollment
   creates one School A student membership, and retries preserve it. School B
   and manager-private rows remain hidden.
5. The student reserves fictional stock, cannot confirm collection, and receives
   a manager-confirmed pickup.

The metadata attack changes the controlled account's ordinary editable metadata;
it never changes its password, email, or authoritative membership directly.
Only fixed-account sessions opened by the suite are signed out. The supplied
student session remains active; remove its private access-token file after the
review. A completed run enrolls the account, so all five scenarios require a
separately authorized unenrolled controlled account on the next full run. Never
delete users/history or bypass the restoration guard to manufacture a fixture.
The core API suite remains independently repeatable with the six fixed accounts.

## Evidence outside this suite

The suite consumes an already verified session. It does not establish the
signup/no-session state, actual receipt of a Resend message, wrong/expired/used
code behavior, resend limits, reload continuation, or uncertain-verification
recovery. Exercise those explicitly in the browser with the owner-controlled
inbox and record results separately; successful provider logs alone do not
establish mailbox receipt or code entry.

An isolated SQL fixture must additionally prove `SL010` denial for absent,
stale/wrong-method OTP AMR or proof more than 60 seconds in the future, live
unconfirmed/anonymous identities, and signed-email/phone mismatches, without
partial membership/ledger changes.
Password-only legacy accounts without memberships require a real email OTP;
existing ledger-backed retries and fixed-role memberships stay preserved. The
ordinary hosted suite must not acquire privileged credentials to construct
those negative identities or alter real hosted users.

Official references rechecked October 23, 2026 for Node 22.20.0, Supabase JS
2.118.0, and the installed hosted Auth service:

- [Node test runner](https://nodejs.org/download/release/v22.20.0/docs/api/test.html)
- [Supabase user authentication](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Email OTP with account creation disabled](https://supabase.com/docs/reference/javascript/auth-signinwithotp)
- [OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp)
- [Supabase JWT claims](https://supabase.com/docs/guides/auth/jwt-fields)
- [Resend SMTP for Supabase](https://resend.com/docs/send-with-supabase-smtp)
