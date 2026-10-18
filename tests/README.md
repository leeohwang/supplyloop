# SupplyLoop verification

The API suite uses only Node's built-in test runner, assertions, and fetch. The core file logs in as the six ordinary fictional accounts and creates uniquely labeled QA items through manager RPCs. The registration file creates one additional fictional Auth account, verifies code-gated enrollment, and exercises its student pickup flow. Both check the hosted backend directly, without an operator/secret key, resets, or deletion of existing records. QA accounts, items, enrollments, and audit history remain in the fictional dataset after the run.

**Current results, October 18, 2026:** all 20 hosted API scenarios passed in 20.21 seconds, with zero failures, cancellations, or skips, after all three migrations, private code configuration, and approved Auth settings were installed. All 16 local error-normalization unit tests passed; type checking, linting, and the production build also passed. Historical pre-registration results were 15 API scenarios in 13.24 seconds and 15 unit tests. See `../docs/verification.md` for evidence and limits.

## Local error-boundary tests

With Node 22.20 or another compatible runtime:

```sh
node --test tests/unit/*.test.mjs
```

The error module is imported using Node's native erasable TypeScript support. These tests need neither credentials nor a browser and verify stable error classification and safe messages.

## Hosted API acceptance

The operator must first apply the three reviewed migrations in order, seed both schools, provision their fixed-role accounts, install the private registration configuration, and enable email/password signup without email confirmation. These prerequisites are complete for the approved hosted project; do not replay migrations or provision/reset accounts to run the tests. Supply the following variables in the ignored `.env.test.local` file; never commit actual values:

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

The complete suite also requires `DEMO_REGISTRATION_ACCESS_CODE` in ignored, owner-only `.env.registration.local`. Run only against the dedicated fictional demo project:

```sh
npm run test:api
```

The script loads both environment files and runs `tests/api/*.test.mjs` serially. To run only the 15 core scenarios without creating a new Auth account:

```sh
node --env-file=.env.test.local --test --test-concurrency=1 tests/api/acceptance.test.mjs
```

Missing configuration fails explicitly. The suite uses two concurrent requests specifically for the reservation and enrollment races. Core checks cover grants/RLS, cross-school and ownership boundaries, hidden staff data, private-schema API denial, closed JSON and nullable draft validation, both categories, matching, reservation/cancellation/release, pickup attribution and idempotency, terminal transitions, and local sign-out scope. Manager membership checks preserve all three fixed fixture users' identities, labels, roles, and active states while allowing additional active School A students; students still read only their own membership.

Only current active students (stored membership role `member`) may reserve or receive items. The hosted suite rejects manager reservations in both schools, checks that those denials change no business or audit rows, and then proves ordinary students can reserve the same stock. Missing and inaccessible manager reservation targets must still return the same `SL003` response. Managers confirm student handoffs; they are not item recipients.

The direct-API tests establish backend behavior. They do not replace browser verification of accessible controls, mobile layouts, sign-out cache clearing, late response suppression, loading/error states, or the full member/manager experience. Earlier local-browser checks covered the core flow; new registration/mobile and public-site acceptance remain pending. Network loss, deliberately delayed requests, and shared-profile cross-tab Auth ordering have not been experimentally verified. The lead should perform applicable browser checks against the same backend in separate sessions.

## Recipient policy regression fixtures

Ordinary API test sessions cannot edit authoritative memberships. Verify the following cases in the backend owner's isolated SQL fixture, or through a separately coordinated operator-prepared fixture; do not add an operator key or membership-write bypass to the API suite:

1. A student reserves, then an operator changes that recipient to `manager` before the first pickup. Manager completion must fail with `SL002`, preserving item, reservation, attribution, and event rows.
2. A student reserves, then their membership becomes inactive before the first pickup. Completion must fail with `SL002` without partial changes.
3. A legacy active reservation names a manager recipient. No manager may complete it, including a different same-school manager. Authorized cancellation/release remains available.
4. A valid student pickup completes, then the recipient is promoted or deactivated. An authorized manager's repeated completion must retain the original completion actor/time, return `changed = false`, and append no event. Historical transfers are not reclassified or erased.
5. Role changes while an allocation waits for an item lock must not bypass the post-lock student check. Confirm a consistent lock order and no partial mutation on denial.

These cases require explicit execution evidence from their fixture runner; the ordinary hosted suite's active-student happy path does not establish the role-change cases.

## Demo registration acceptance

Migration `20261018000300`, private code configuration, and email/password signup without email verification are installed in the dedicated demo project. Anonymous sign-in and manual identity linking remain disabled. For a fresh environment, obtain the lead's readiness confirmation before this mutating test. The full-suite script above is equivalent to loading both ignored, owner-only environment files explicitly:

```sh
node --env-file=.env.test.local --env-file=.env.registration.local --test --test-concurrency=1 tests/api/*.test.mjs
```

`DEMO_REGISTRATION_ACCESS_CODE` is supplied only to the enrollment RPC, never to Auth metadata. The registration file creates one uniquely addressed fictional Auth account per run and retains its enrollment, inventory transaction, and history. It does not use a secret key, delete accounts, reset passwords, or restore stock. Wrong-code signup still leaves an Auth account with no school membership, because the code gates enrollment rather than Auth account creation.

The five registration scenarios verify: no access across all six app tables before enrollment; anonymous/private-state denial; bad code/blank label without partial membership; unchanged memberships for all six fixed accounts; ignored editable metadata and rejected school/role RPC overrides; concurrent/idempotent enrollment into School A as a student; School B/private-data isolation; and student reservation followed by manager-confirmed pickup. Auth user/identity responses must not contain the code.

All five hosted registration scenarios passed as part of the current 20-scenario run. Local PostgreSQL 17.11 checks additionally passed for absent/disabled configuration, code rotation/disable with preserved retries, inactive/promoted ledger-backed accounts, all private table privileges, and the unchanged exact-six restoration guard. These require trusted local fixtures and were not tested by privileged changes to the hosted demo. With new registrations present, restoration must refuse rather than erase the added users' history.

## Documentation checked October 18, 2026

- [Node test runner, installed version](https://nodejs.org/download/release/v22.20.0/docs/api/test.html), [fetch](https://nodejs.org/download/release/v22.20.0/docs/api/globals.html), and [native TypeScript](https://nodejs.org/download/release/v22.20.0/docs/api/typescript.html).
- [Supabase database testing](https://supabase.com/docs/guides/database/testing), [password authentication](https://supabase.com/docs/guides/auth/passwords), and [local sign-out semantics](https://supabase.com/docs/guides/auth/signout).
- [PostgREST error codes](https://docs.postgrest.org/en/stable/references/errors.html). Verify actual error behavior against the deployed service; stable documentation currently identifies PostgREST 16.
