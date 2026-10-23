# SupplyLoop verification

The hosted API suites use Node's built-in test runner, assertions, and fetch with ordinary authenticated sessions. Core tests log in as the six fixed fictional accounts and create labeled QA stock through manager RPCs. Registration tests consume an explicitly supplied recent real email-OTP session; they do not create Auth accounts or send email automatically. Neither suite uses an operator/service-role key, resets shared data, or deletes existing records. QA stock, student enrollments, and pickup/audit history remain after the run.

**October 23, 2026:** the fresh hosted core baseline passed all **15 scenarios**, with zero failures, cancellations, or skips (32.46 seconds including the runner). All **42 local unit cases** passed: 17 error-normalization cases, including `SL010`, and 25 Auth lifecycle cases using the actual pinned Supabase SDK with fake transport, storage, and locks. The isolated PostgreSQL 17 email-enrollment security regression also passed and was independently rerun, including concurrent enrollment. The fresh core baseline preceded the email-confirmation cutover.

The new email release's actual-inbox signup, Resend delivery/code entry, five hosted registration scenarios, and browser walkthrough are **not yet verified**. Prepared code and passing isolated SQL checks do not establish successful email delivery or completion of this release.

Historical October 18 evidence covers the original autoconfirmed demo: 20 hosted API scenarios, 16 unit cases, and successful public desktop/phone registration and student/manager handoff checks. Those results do not prove the new email flow. See [the verification record](../docs/verification.md) for dated evidence and limits.

## Local unit tests: 42 cases

With Node 22.20 or another compatible runtime:

```sh
npm test
```

The tests use Node's native erasable TypeScript support and need neither credentials nor a browser. The 17 cases in `unit/errors.test.mjs` verify stable error classification and safe messages without exposing raw backend details.

The 25 cases in `unit/auth-lifecycle.test.mjs` use the installed Supabase JS **2.118.0** SDK against fabricated sessions and fake fetch, shared storage, storage events, and Web Locks. They cover delayed response headers and bodies, transports that ignore abort, sign-out and account switching after SDK persistence begins, queued action deadlines, a newer signup returning no session, ordinary OTP verification and refresh, unavailable coordination primitives, crash recovery, and local sign-out fallback after SDK session-read failure. Current-only logout cleanup may finish after its own deadline; superseded cleanup cannot remove the newer account. No native fetch fallback, credential files, inboxes, or hosted requests are used.

The unguarded-SDK control reproduces the original defect: a delayed OTP response restores the old account after another tab has signed out. That control intentionally asserts the incorrect baseline; the coordinated cases assert that it cannot reach accepted UI state. A separate disposable comparison restoring only the former unconditional `pending: false` settlement policy failed the queued-timeout regression because it accepted the old account's late SDK save. The candidate passed that same regression with explicit recovery required.

The two ordinary Auth transport deadline cases exercise the exact factory fetch boundary supplied to the SDK, avoiding its separate 30-second refresh retry sequence. A separate case runs the actual SDK refresh through a newer account intent and verifies that the transport is not cancelled by that intent and the SDK's refresh commit guard preserves completed sign-out. These checks prove the tested coordinator/SDK behavior with simulated browser primitives. They do not establish real browser cross-tab timing, offline behavior, Resend delivery, or the complete signup/enrollment experience.

## Hosted core API acceptance: 15 scenarios

Run only against the dedicated fictional demo project. The reviewed schema, two schools, fixed-role accounts, and private enrollment configuration are operator prerequisites. Do not replay migrations, provision accounts, or reset data to run the suite. Supply these values in ignored, owner-only `.env.test.local`; never commit actual values:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
DEMO_A_MANAGER_EMAIL
DEMO_A_MANAGER_PASSWORD
DEMO_A_MEMBER1_EMAIL
DEMO_A_MEMBER1_PASSWORD
DEMO_A_MEMBER2_EMAIL
DEMO_A_MEMBER2_PASSWORD
DEMO_B_MANAGER_EMAIL
DEMO_B_MANAGER_PASSWORD
DEMO_B_MEMBER1_EMAIL
DEMO_B_MEMBER1_PASSWORD
DEMO_B_MEMBER2_EMAIL
DEMO_B_MEMBER2_PASSWORD
```

Run the core suite without requesting signup or email:

```sh
npm run test:api
```

This loads only `.env.test.local` and runs `tests/api/acceptance.test.mjs` serially. It does not run registration. The equivalent direct command is:

```sh
node --env-file=.env.test.local --test --test-concurrency=1 tests/api/acceptance.test.mjs
```

Missing configuration fails explicitly. Two concurrent requests exercise the reservation race. Core checks cover grants/RLS, school and ownership boundaries, hidden staff data, private-schema and direct-table-write denial, closed JSON/null validation, both categories, structured matching and condition ranking, cancellation/release, pickup attribution and idempotency, terminal transitions, audit events, rollback, and local sign-out scope. Manager membership checks preserve the fixed users' identities, labels, roles, and active states while allowing additional active School A students; students still read only their own membership.

Only current active students (stored membership role `member`) may reserve or receive items. The hosted suite rejects manager reservations in both schools, checks that those denials change no business or audit rows, and then proves ordinary students can reserve the same stock. Missing and inaccessible manager reservation targets must still return the same `SL003` response. Managers confirm student handoffs; they are not item recipients.

The direct API tests establish backend behavior. They do not replace browser checks of accessible controls, mobile layouts, sign-out cache clearing, late responses, loading/error states, or the full student/manager experience. Public desktop/phone acceptance passed on October 18 for the former registration flow; a fresh walkthrough of the new email release remains pending. Delayed Auth responses and shared-profile ordering are now covered by the simulated unit checks above; deliberate network loss and cross-tab behavior in a real browser remain unverified.

## Recipient policy regression fixtures

Ordinary API test sessions cannot edit authoritative memberships. Verify the following cases in the backend owner's isolated SQL fixture, or through a separately coordinated operator-prepared fixture; do not add an operator key or membership-write bypass to the API suite:

1. A student reserves, then an operator changes that recipient to `manager` before the first pickup. Manager completion must fail with `SL002`, preserving item, reservation, attribution, and event rows.
2. A student reserves, then their membership becomes inactive before the first pickup. Completion must fail with `SL002` without partial changes.
3. A legacy active reservation names a manager recipient. No manager may complete it, including a different same-school manager. Authorized cancellation/release remains available.
4. A valid student pickup completes, then the recipient is promoted or deactivated. An authorized manager's repeated completion must retain the original completion actor/time, return `changed = false`, and append no event. Historical transfers are not reclassified or erased.
5. Role changes while an allocation waits for an item lock must not bypass the post-lock student check. Confirm a consistent lock order and no partial mutation on denial.

These cases require explicit execution evidence from their fixture runner; the ordinary hosted suite's active-student happy path does not establish the role-change cases. Earlier local checks are documented in the verification record. The new email-enrollment runner below does not replace those recipient-policy regressions.

## Controlled registration acceptance: 5 scenarios

Create the ignored, owner-only email-test configuration:

```sh
cp .env.email-test.example .env.email-test.local
chmod 600 .env.email-test.local
```

Set `DEMO_REGISTRATION_TEST_EMAIL` to the explicitly authorized inbox and `DEMO_REGISTRATION_SESSION_FILE` to its ignored, owner-only session file. That file contains only `{"access_token":"..."}` from an ordinary recent real email-OTP session, never an operator token. The account must have no school membership when the suite starts. Keep `DEMO_REGISTRATION_ACCESS_CODE` in owner-only `.env.registration.local`; it goes only to the enrollment RPC, never Auth metadata or email templates.

Follow [the controlled email recipe](EMAIL_CONFIRMATION.md) to receive and verify a code privately. Helper invocations must load `.env.email-test.local` as well as the existing environment files. Sending is an explicit opt-in action for the selected existing account, with account creation disabled. No helper email action is part of an automated API command.

Once the real OTP session file is ready:

```sh
npm run test:registration
```

This loads `.env.test.local`, `.env.registration.local`, and `.env.email-test.local`, then runs only `tests/api/registration.test.mjs`. It authenticates the supplied token with live Auth, checks the confirmed non-anonymous email against the signed session and recent OTP proof, and refuses an already enrolled fixture.

The five scenarios verify: no school access after email confirmation alone; anonymous/private-state denial; bad community code/blank label without partial membership; unchanged fixed accounts; editable metadata and role/school argument attacks; concurrent/idempotent School A student enrollment; School B/private-data isolation; and a student reservation with manager-confirmed pickup. Auth user/identity responses must not contain the community code.

The suite signs out only fixed test sessions it creates. It does not revoke the supplied student session, change its password, or confirm it administratively. Enrollment, fictional stock, and pickup history remain, so all five scenarios require a separately authorized unenrolled controlled account on the next full run. The core suite remains independently repeatable.

**These updated hosted scenarios have not yet run.** The original five passing October 18 scenarios used the former autoconfirmed flow and are historical evidence only. The exact-six restoration guard intentionally refuses once added registrations exist; do not delete users/history or bypass that guard to manufacture fixtures.

## Isolated email-enrollment security regression

With PostgreSQL 17 `initdb`, `pg_ctl`, and `psql` on PATH:

```sh
npm run test:enrollment-security
```

The runner creates its own disposable, owner-only temporary cluster and Unix socket, accepts no server/credential arguments, makes no hosted requests, and removes only its own cluster after shutdown. The local environment must permit PostgreSQL shared memory and socket creation.

This passed on PostgreSQL 17.11. It checks the constrained private Auth bridge and denied helper calls; live confirmation/nonanonymous identity; matching signed email; malformed/missing claims; OTP method and one-hour proof age with a 60-second future-clock allowance; forged metadata; unchanged rows on rejection; new and legacy unenrolled accounts; fixed memberships and ledger-backed retries; preserved completed history; and concurrent enrollment into one membership. Its trusted local JWT fixtures exercise database authorization, not email delivery, browser behavior, or hosted Auth settings.

## Official documentation

Current guidance was retrieved October 23, 2026 for Node 22.20.0, Supabase JS 2.118.0, hosted Supabase Auth, and PostgreSQL 17. The implementation notes record the broader project documentation checkpoint.

- [Node test runner, installed version](https://nodejs.org/download/release/v22.20.0/docs/api/test.html), [fetch](https://nodejs.org/download/release/v22.20.0/docs/api/globals.html), and [native TypeScript](https://nodejs.org/download/release/v22.20.0/docs/api/typescript.html).
- [Supabase database testing](https://supabase.com/docs/guides/database/testing), [password authentication](https://supabase.com/docs/guides/auth/passwords), and [local sign-out semantics](https://supabase.com/docs/guides/auth/signout).
- [Supabase JWT claims](https://supabase.com/docs/guides/auth/jwt-fields) and [OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp).
- PostgreSQL 17 [initdb](https://www.postgresql.org/docs/17/app-initdb.html), [pg_ctl](https://www.postgresql.org/docs/17/app-pg-ctl.html), and [function security](https://www.postgresql.org/docs/17/sql-createfunction.html).
- [Resend SMTP with Supabase](https://resend.com/docs/send-with-supabase-smtp).
