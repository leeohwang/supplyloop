# SupplyLoop backend

The versioned migrations target the inspected Supabase PostgreSQL 17.11 environment. The frontend uses the publishable key and signed-in user session. Privileged keys are operator-only.

**Hosted status, October 18, 2026:** migrations `20261018000100_supplyloop_core.sql`, `20261018000200_student_only_recipients.sql`, and `20261018000300_demo_registration.sql` were applied manually through the Supabase SQL Editor to `supplyloop-demo` (`myyfdtqpeqbhnxwlpkeg`, North Virginia). The hosted public catalog has six RLS tables, 65 columns, 13 foreign keys, and eight public RPCs. Registration also has two unexposed private RLS tables. The application owner has no global RLS bypass. Private enrollment configuration is installed; email/password signup is enabled without email confirmation, while anonymous sign-in and manual identity linking remain off. The approved exact Auth URL allowlist is configured. All 20 hosted API scenarios passed using ordinary authenticated sessions, with zero failures, cancellations, or skips in 20.21 seconds. All 16 unit tests, type checking, linting, and the production build passed. Initial provisioning created two fictional schools, six fixed-role accounts, and 11 inventory fixtures; later registration and QA records are retained, so these are initial counts. Public deployment and the new registration browser/mobile walkthrough remain unverified.

1. For the existing hosted project, skip application of all three listed migrations: they are already applied. Preserve the versioned files; role/table creation statements are intentionally not replayable over the installed schema. A fresh empty backend requires its own reviewed application of the migrations in order, fixture provisioning, private registration configuration, and environment verification.
2. In the private `.env.operator.local`, set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` for the approved `supplyloop-demo` project. The lead maintains the ignored environment templates; never commit real keys.
3. Run `npm run demo:provision`. The operator script creates two fictional schools, six confirmed fixed-role accounts, memberships, and the inventory in `fixtures.mjs`. Inventory intake/publication/retirement uses ordinary authenticated manager RPCs. It writes independent generated reviewer passwords to ignored `.env.test.local` with mode 0600 and prints no credentials.

`node --env-file=.env.operator.local scripts/operator/provision.mjs --check` validates the target/configuration and reports the planned fixture counts without a network request, credential generation, or mutation. The real provisioner refuses other projects, conflicting schools/accounts/memberships, and edited fixtures. Ordinary reruns preserve existing reservations, transfers, and history; they resume incomplete initial publication but do not reset passwords or overwrite app changes.

`seed.sql` is a data-only definition of the two fictional schools for migration/seed workflows. Auth accounts/passwords do not belong in SQL seed files. The operator script can create these same school rows when the SQL seed has not been run.

## Deployed student-only recipient policy

`migrations/20261018000200_student_only_recipients.sql` was applied successfully through the hosted SQL Editor after local validation and review. The applied file's SHA-256 is `ce95abd7e60677da5747516c7cbaeaa487e600abecc7687fb06b18e979b07199`. It is a forward migration after the installed initial migration; both versioned files remain preserved.

The policy permits only active students (the stored membership role `member`) to reserve or newly receive an item. A manager's authorized same-school reservation attempt returns `SL002`; missing and inaccessible targets retain identical `SL003` behavior. New pickup completion also returns `SL002` when the recipient is inactive or now a manager. Eligibility is checked after inventory/reservation locks, and a shared membership lock holds it through commit. The migration changes no existing rows: cancelled records remain historical, existing active allocations are retained for authorized release, and completed-pickup retries preserve their original outcome even after a recipient's role changes. Current manager authorization and the prohibition on self-confirmation still apply to retries.

At this policy-only stage, the original seven public signatures, table schema, constrained owner, grants, and empty function search paths remained unchanged, so that function-body update did not require type regeneration. Local PostgreSQL 17.11 checks passed for unchanged existing data/security, both-school denials, error parity, promoted/inactive recipients, completed history, membership changes during lock waits, membership-lock serialization, and the two-student reservation race. Historical hosted verification after migration two passed all 15 core scenarios in 13.24 seconds, including manager reservation denial in both schools with unchanged snapshots and successful student reservation afterward. Those checks also pass within the current 20-scenario run; migration three adds the eighth public RPC and refreshed types described below.

## Demo registration

`migrations/20261018000300_demo_registration.sql` was reviewed, validated on isolated PostgreSQL 17.11, and applied to `supplyloop-demo`, along with its private hashed configuration. The applied migration's SHA-256 is `1c13868cb257122ed11d095ee1d7cf689bcd8c35935af0acc6c435ad271af9b2`. Approved email/password signup is enabled without email confirmation; anonymous sign-in and manual identity linking remain off. All 20 hosted API scenarios, including five registration scenarios, pass. The migration adds authenticated `join_demo_school(p_access_code text, p_display_label text)`, returning one `public.memberships` composite row for `.single()`, plus private code configuration and enrollment provenance. It does not rewrite existing accounts, memberships, inventory, or the restoration script.

This is a demo account flow with no email verification. A plain email/password Auth signup creates a real account and session, initially with no school access. The private access code gates membership: new enrollment creates only an active School A student (`member`). It does not prevent Auth account creation by someone without the code and does not establish email ownership or school identity. Pass the code only to the enrollment RPC; never put it in Auth user metadata, URLs, frontend environment variables, source, or logs. Managers remain operator-granted.

The RPC derives its actor from the session, trims a nonblank display label, and ignores editable Auth metadata for authorization. Existing memberships, including inactive or manager memberships, cause `SL002`; they are never reassigned or reactivated. A prior ledger-backed active student receives their existing membership on retry, with its original label/time even after code rotation or disable. New enrollment fails closed with `SL009` when configuration is absent, disabled, or the code is wrong; a blank label returns `SL004`. Concurrent calls from one actor serialize and atomically create one membership and ledger entry. Private tables have RLS enabled and no ordinary-role table grants.

Prepare the actual code offline from the repository root:

```sh
node scripts/operator/prepare-registration.mjs --check
node scripts/operator/prepare-registration.mjs
```

The first command reports metadata only and changes nothing. The second creates owner-only (0600), ignored `.env.registration.local` containing `DEMO_REGISTRATION_ACCESS_CODE`, and `.registration-setup.local` containing guarded SQL with only the SHA-256 digest. It prints no code, reads no existing credential files, makes no requests, and refuses to overwrite either output. This preparation and application are already complete for the current project; do not rerun them to execute acceptance tests. In a fresh environment, the lead reviews and applies the migration and prepared SQL before explicitly configuring email/password signup without email confirmation. There is no default automatic code expiry or registration cap. An operator can disable or rotate enrollment configuration; already enrolled students retain their membership.

Registration tests create retained fictional accounts and transactions using ordinary sessions. Existing fixed credentials remain unchanged. The exact-six restoration guard deliberately refuses once additional School A students enroll, protecting their history from the old bulk demo reset. Do not weaken it or reset registration data implicitly. See `../tests/README.md` for commands and remaining operator-only checks.

Documentation checked October 18, 2026: Supabase [signup](https://supabase.com/docs/reference/javascript/auth-signup), [single-row results](https://supabase.com/docs/reference/javascript/single), and [Auth configuration](https://supabase.com/docs/guides/auth/general-configuration); PostgreSQL 17 [SHA-256 and encoding](https://www.postgresql.org/docs/17/functions-binarystring.html), [transaction advisory locks](https://www.postgresql.org/docs/17/explicit-locking.html), and [composite SQL function results](https://www.postgresql.org/docs/17/xfunc-sql.html).

## Adopting the CLI after manual application

The dashboard applications do not establish that the CLI migration-history table contains versions `20261018000100`, `20261018000200`, and `20261018000300`. No CLI history repair has been performed here.

When an operator later installs/pins the CLI, initializes its configuration, and links the verified project, inspect the installed schema/functions and `supabase migration list --linked`. After confirming the installed definitions match the reviewed migrations, repair only versions missing from remote history. If all three are missing, record their existing applications using:

```sh
supabase migration repair 20261018000100 --status applied --linked
supabase migration repair 20261018000200 --status applied --linked
supabase migration repair 20261018000300 --status applied --linked
supabase migration list --linked
supabase db push --dry-run --linked
```

The repairs update migration history without executing the migrations. Confirm all three versions appear locally and remotely and that the dry run proposes none of these installed migrations. Do not replay them, mark them reverted, or delete their history entries to force a push. Preserve the applied files and put subsequent schema changes in new versioned migrations. Migration-history repair does not install private enrollment configuration or change Auth settings. [CLI history repair](https://supabase.com/docs/reference/cli/supabase-migration-repair), [migration list](https://supabase.com/docs/reference/cli/supabase-migration-list), and [push dry run](https://supabase.com/docs/reference/cli/supabase-db-push), rechecked October 18, 2026.

## Reproducing the client database types

`schema-catalog.json` is the refreshed read-only catalog snapshot exported from the actual PostgreSQL 17.11 project after migration three. It contains six public tables, 65 columns, 13 foreign-key relationships, and eight public RPCs, including `join_demo_school`. It contains schema metadata only and excludes private enrollment configuration, inventory, account rows, passwords, and keys.

After applying a reviewed schema change, run `introspect-types.sql` in the verified project's SQL Editor. Export the single `supplyloop_schema` JSON result to `supabase/schema-catalog.json`. The offline generator accepts either the JSON value itself or a one-row JSON export containing that column. Preserve valid JSON; do not paste the result into a credential file or edit its metadata by hand.

From the repository root, regenerate and check the client types:

```sh
node scripts/operator/generate-types.mjs supabase/schema-catalog.json > src/lib/database.generated.types.ts
npm run check
```

The generator uses only Node built-ins, makes no network requests, and writes TypeScript to standard output. Review the generated diff alongside the applied migration. Keep `src/lib/database.generated.types.ts` generated; `src/lib/database.types.ts` preserves its insert/update defaults, relationships, and RPC signatures while narrowing row text fields to the reviewed CHECK-constrained application vocabulary. PostgreSQL function signatures do not encode scalar nullability, so RPC argument/results remain conservatively nullable in generated types. The client adapter validates mutation results before using the stricter application result type.

The current checked-in generated file reproduces exactly from this hosted catalog snapshot. All six wrapper row field sets match the generated rows. Catalog references checked October 18, 2026: PostgreSQL 17 [columns](https://www.postgresql.org/docs/17/catalog-pg-attribute.html), [functions](https://www.postgresql.org/docs/17/catalog-pg-proc.html), [constraints](https://www.postgresql.org/docs/17/catalog-pg-constraint.html), [types](https://www.postgresql.org/docs/17/catalog-pg-type.html), and [indexes](https://www.postgresql.org/docs/17/catalog-pg-index.html).

## Fictional data restoration and security

`restore-demo.sql` is an explicit operator-only restoration for the original exact-six-account fixture. Registration acceptance has added a student, so its existing guard now refuses restoration; do not bypass the guard or delete enrollments to force a reset. Any recovery for the expanded dataset needs a separately reviewed operator plan that preserves registered users' history. For an environment still containing only the original six memberships, review the script through trusted tooling before any restoration and subsequent `npm run demo:provision`. Restoration is transactional, school-scoped, checks operator-managed demo markers, and preserves Auth users/memberships/other schools. Retain the original `.env.test.local`; there is no public reset endpoint or implicit password rotation.

The application owner has no managed `auth` schema access. `private.session_actor()` mirrors the exact hosted `auth.uid()` implementation inspected October 18, 2026, reading only the JWT claims set by PostgREST. It accepts no actor argument. Policies use narrowly granted membership/ownership helpers; privileged mutations enforce their own actor, school, role, ownership, and state checks. The unexposed `private` schema must stay out of the Data API's exposed-schema setting.

Validation performed during development: all three migrations were executed in an isolated local PostgreSQL 17.11 cluster as a non-superuser `postgres` role with hosted-style restricted Auth ACLs. Core smoke checks, student-only role/lock regressions, a two-session reservation race, and registration/configuration/restore-guard regressions passed. The current hosted run passed all 20 ordinary-session API scenarios in 20.21 seconds, including registration authorization/retries and a registered student's pickup. No reset was performed. Historical verification after migration two was 15 scenarios in 13.24 seconds. See `../tests/README.md` for commands and retained fixture effects. New registration browser/mobile and public deployment checks remain pending; API tests do not establish them. Deliberate network loss, delayed responses, and shared-profile cross-tab Auth ordering remain experimentally unverified.

Official sources retrieved October 18, 2026: [PostgreSQL 17 row locks](https://www.postgresql.org/docs/17/explicit-locking.html), [partial unique indexes](https://www.postgresql.org/docs/17/sql-createindex.html), [constraints](https://www.postgresql.org/docs/17/ddl-constraints.html), [function security](https://www.postgresql.org/docs/17/sql-createfunction.html), [grants](https://www.postgresql.org/docs/17/sql-grant.html), [policies](https://www.postgresql.org/docs/17/sql-createpolicy.html), [custom SQLSTATEs](https://www.postgresql.org/docs/17/plpgsql-errors-and-messages.html); Supabase [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions), [admin account creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [account listing](https://supabase.com/docs/reference/javascript/auth-admin-listusers), [RPC](https://supabase.com/docs/reference/javascript/rpc), [client configuration](https://supabase.com/docs/reference/javascript/initializing), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), and [sign-out scopes](https://supabase.com/docs/guides/auth/signout); Node 22.20 [crypto](https://nodejs.org/download/release/v22.20.0/docs/api/crypto.html), [filesystem](https://nodejs.org/download/release/v22.20.0/docs/api/fs.html), and [environment parsing](https://nodejs.org/download/release/v22.20.0/docs/api/util.html#utilparseenvcontent).
