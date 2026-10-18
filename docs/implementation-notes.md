# SupplyLoop implementation notes

## Research checkpoint — October 18, 2026

Status: the prototype is live at `https://leeohwang.github.io/supplyloop/`, connected to the approved hosted project. Three reviewed migrations are applied, including real demo account registration and private-code enrollment. All 20 ordinary-session hosted API scenarios and 16 unit tests pass, along with type checking, lint, and production build. Public desktop/phone registration and a new student's manager-confirmed handoff were verified. A phone pickup-code overflow was fixed and retested on the deployed app. Managers use Manager desk only; students alone reserve and receive items. See `docs/verification.md` for evidence and limits.

## Confirmed user choices

- Create a new hosted Supabase project for fictional demo data.
- Create a separate organization named SupplyLoop rather than using the existing `handoff` organization.
- Organization type: Educational; plan: Free. Project name: `supplyloop-demo`; region: East US (North Virginia).
- Use a clean, accessible interface with a green accent.
- Clothing types: shirt, sweater, jacket, trousers, and skirt; letter sizes XS–XXL; conditions ordered New, Like new, Good, Fair.
- Use in-page navigation, show only available items in Find, and limit sign-out to the current browser session. Account for these choices in backend implementation.
- Use fictional School A/School B, Main office pickup, and Demo term. Permit incomplete intake drafts, with full validation before publication. Managers enter color/variant; optional measurements support cm or inches. Retirement reasons are unsuitable/damaged/missing; manager-release reasons are uncollected/member request/stock issue.
- Explain work as it proceeds. If anything is unclear, ask the user and wait before implementing.
- Students alone may reserve and receive items. Managers operate inventory and handoffs, with this rule enforced server-side as well as in the interface. The stored `member` role represents a student; no new membership role or account migration is needed.
- Manager accounts open directly into Manager desk, with Find and My pickups removed, as explicitly selected by the user.

## Environment inspected

| Component | Observed state |
| --- | --- |
| Node.js | 22.20.0 |
| npm | 11.6.1 |
| PostgreSQL client (`psql`) | 17.11; this is not the backend server version |
| Docker / Supabase CLI | No executable found on the current PATH |
| Repository | Official published Vite React/TypeScript scaffold, pinned manifest/lockfile, completed core screens and adapter, shared contract types, operator tooling, and independent test suites |
| Supabase access | Healthy project `supplyloop-demo`, reference `myyfdtqpeqbhnxwlpkeg`, in the separate Educational/Free `SupplyLoop` organization (`iqmjcqxusvrxsdrvsvyr`), us-east-1. Data API enabled, automatic table exposure disabled. Six public application tables have grants and RLS; code-gated enrollment uses two inaccessible private tables. Approved email/password signup is open without email verification; no school access until valid enrollment. |
| Hosted database | PostgreSQL 17.11, verified by SQL Editor query; postgres is non-superuser with CREATEROLE and BYPASSRLS |

The installed Node version meets the retrieved Vite and Supabase JS minimum requirements. Verify the exact published dependency versions and their engine requirements before installation. Do not change the user's runtime or select an experimental local backend without discussion.

### Published dependency verification

Read-only official npm registry queries were completed on October 18, 2026. Restricted-shell DNS failed; an authorized network-enabled read succeeded. The verified selections were then installed and captured in the lockfile.

| Package | Published latest verified | Compatibility evidence |
| --- | --- | --- |
| React / React DOM | 19.3.1 | React DOM requires React `^19.3.1` |
| TypeScript | 7.0.2 | The official Vite React/TypeScript template still uses `~6.0.2`; registry verification also confirmed 6.0.2 is published |
| Vite | 8.3.4 | Node `^20.19.0` or `>=22.12.0` |
| Vite React plugin | 6.1.2 | Same Node requirement; Vite `^8.0.0` peer |
| Supabase JS | 2.118.0 | Node `>=22` |
| React / React DOM typings | 19.3.0 | DOM typings require React typings `^19.3.0` |

The implementation scaffold will follow the official template's compiler baseline rather than silently adopting a newer compiler major. Final installed versions must be captured in the lockfile and verified with type checking and a production build.

The published create-vite 9.2.1 template differs from GitHub main: it uses Oxlint rather than ESLint. Retained its configuration and checked the current [Oxlint configuration](https://oxc.rs/docs/guide/usage/linter/config.html), [plugins](https://oxc.rs/docs/guide/usage/linter/plugins.html), [Hooks rule](https://oxc.rs/docs/guide/usage/linter/rules/react/rules-of-hooks.html), and [Fast Refresh rule](https://oxc.rs/docs/guide/usage/linter/rules/react/only-export-components.html). Also read [TypeScript 6 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html), [DefinitelyTyped guidance](https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/README.md), and [TypeScript types configuration](https://www.typescriptlang.org/tsconfig/types.html). Node typings use the installed runtime's major version 22. Initial npm installation added 79 packages and reported zero known vulnerabilities; build and behavior verification are separate checks.

## Official documentation retrieved

The lead and research subagents retrieved and read these official sources on October 18, 2026. Recheck as needed when dependencies or the environment change. Documentation examples are references, not instructions to add sample tables, public access policies, magic-link sign-in, or features outside SupplyLoop's architecture.

### Frontend

- [React: building an app from scratch](https://react.dev/learn/build-a-react-app-from-scratch) and [TypeScript integration](https://react.dev/learn/typescript): React/TypeScript with Vite fits the approved SPA architecture.
- [Vite: getting started](https://vite.dev/guide/), [TypeScript handling](https://vite.dev/guide/features.html#typescript), and [environment variables](https://vite.dev/guide/env-and-mode.html): use the React/TypeScript template, perform explicit type checking, and treat `VITE_*` values as browser-visible.
- [Official Vite React/TypeScript template manifest](https://raw.githubusercontent.com/vitejs/vite/main/packages/create-vite/template-react-ts/package.json): retrieved template ranges were React/React DOM `^19.3.0`, TypeScript `~6.0.2`, Vite `^8.3.4`, and React plugin `^6.1.2`. These upstream ranges are not installed or pinned selections; verify published versions before using them.
- [TypeScript JSX reference](https://www.typescriptlang.org/docs/handbook/jsx.html): verify JSX and type-checking configuration against the selected TypeScript release.
- [Supabase React quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs): project URL and publishable key configure the browser client. Its public sample-table policies do not apply to this app.

### Backend, authentication, and client integration

- [Supabase JS initialization](https://supabase.com/docs/reference/javascript/initializing), [TypeScript support](https://supabase.com/docs/reference/javascript/typescript-support), and [generated database types](https://supabase.com/docs/guides/api/rest/generating-types): use one typed client and generate types from the implemented schema.
- [Supabase JS release 2.118.0](https://github.com/supabase/supabase-js/releases/tag/v2.118.0) and [support policy](https://github.com/supabase/supabase-js#support-policy): this release was retrieved during research; confirm registry availability and engine compatibility before selecting an exact version.
- [Password authentication](https://supabase.com/docs/guides/auth/passwords), [password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), and [auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange): use fixed-account password login and clean up auth subscriptions.
- [Admin account creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser) and [Auth configuration](https://supabase.com/docs/guides/auth/general-configuration): provision the original confirmed fictional accounts through trusted tooling; the later approved signup extension is documented below.
- [Sign-out behavior](https://supabase.com/docs/reference/javascript/auth-signout): explicitly select the user-approved scope rather than accepting global sign-out accidentally.
- [RPC calls](https://supabase.com/docs/reference/javascript/rpc), [database functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and [API security](https://supabase.com/docs/guides/api/securing-your-api): enforce authorization, grants, and transitions in the database. Verify project defaults rather than assuming grants are safe.
- [API keys](https://supabase.com/docs/guides/getting-started/api-keys): browser publishable key only; privileged keys remain outside frontend code and version control.
- [Migrations](https://supabase.com/docs/guides/local-development/database-migrations), [seeding](https://supabase.com/docs/guides/local-development/seeding-your-database), and [CLI setup](https://supabase.com/docs/guides/local-development/cli/getting-started): version schema and seed changes; inspect the hosted project before applying changes. No local container runtime is required for ordinary hosted API requests.
- [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html) and [partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html): support atomic reservations and one active allocation per item. Retrieved current pages identified PostgreSQL 18; inspect the actual Supabase server version and consult its versioned documentation before implementing SQL.

### Verification

- [Node 22.20.0 test runner](https://nodejs.org/download/release/v22.20.0/docs/api/test.html), [current test runner](https://nodejs.org/api/test.html), and [Node 22.20.0 globals](https://nodejs.org/download/release/v22.20.0/docs/api/globals.html): built-in tests and `fetch` can exercise a hosted backend with ordinary authenticated sessions without a new testing dependency.
- [Supabase database testing](https://supabase.com/docs/guides/database/testing) and [CLI database-test reference](https://supabase.com/docs/reference/cli/supabase-test-db): application-level API tests complement SQL tests. The documented CLI database-test path requires a container/local stack, so it cannot be assumed available here.
- [Playwright installation](https://playwright.dev/docs/intro), [authentication](https://playwright.dev/docs/auth), [emulation](https://playwright.dev/docs/emulation), and [network handling](https://playwright.dev/docs/network): evaluated for independent browser sessions, mobile layouts, and failure testing. No Playwright dependency or browser has been installed; verify platform/version compatibility before selecting it. Ignore any saved authentication state.

## Backend implications of approved interface behavior

- Available-only Find is an explicit query filter, not an authorization boundary. The database still maintains reserved, transferred, and retired states. Authorized personal pickup/history queries must retain the item details needed after a reservation or transfer; manager inventory and queues must include their relevant states.
- Every reservation RPC rechecks current availability under the item lock, even if the frontend just displayed the item as available. A competing reservation must produce a clear failure and a refresh of the affected catalog and personal records.
- In-page navigation changes presentation only. Every read and mutation must remain protected through database permissions and authenticated membership regardless of which screen is visible.
- Use Supabase local-session sign-out explicitly and clear private client state. Other browser sessions remain unaffected. Do not claim that clearing the UI or revoking a refresh token instantly invalidates every already-issued access token; backend authorization remains enforced by the session/JWT and database rules.

## Hosted permission compatibility

The hosted `public` schema is owned by `pg_database_owner`; postgres can grant its usage/create privileges. The internal `auth` schema is owned by `supabase_admin`; postgres has usage but cannot grant it to a new application owner. The existing `auth.uid()` executes publicly but still requires auth-schema usage.

The backend implementation therefore uses a private, narrow session-actor helper mirroring the actual hosted `auth.uid()` derivation from verified PostgREST request JWT settings (`request.jwt.claim.sub`, falling back to `request.jwt.claims` → `sub`). It must not expose arbitrary SQL or accept client-supplied actor claims. This preserves the constrained non-login application owner without broadening access to Auth's internal schema. Reproduce the hosted ACLs in local verification and test the real API after deployment.

## Remaining access and deployment checkpoints

The public client URL/key are configured in ignored `.env.local`. The user supplied the server-only key through owner-only, ignored `.env.operator.local`; the reviewed provisioner completed successfully. Generated fictional credentials are in owner-only, ignored `.env.test.local`. No server-only key is present in browser configuration or source. Do not print or commit either private environment file.

The user selected GitHub Pages at `https://leeohwang.github.io/supplyloop/` and privately shared existing fictional student/manager logins for judges. The GitHub connection was verified as `leeohwang`. The existing `leeohwang.github.io` website uses HTTPS with no custom domain, and no existing `/supplyloop` source directory was found. The user approved creation of the separate public `leeohwang/supplyloop` repository; it was created, with only the two public Supabase browser variables configured for Actions. The main website's publishing configuration is unchanged.

The user approved demonstrable backend registration: email/password creates an actual Supabase account, followed by privately shared access-code enrollment into School A as a student. Email and school identity are explicitly unverified for this fictional demo. Migration `20261018000300_demo_registration.sql` and the private digest configuration were reviewed, locally tested on PostgreSQL 17.11, and applied successfully. Public email/password signup is enabled and email confirmation disabled as approved; anonymous signup and manual linking remain disabled. The Site URL and exact redirect allowlist are `https://leeohwang.github.io/supplyloop/`. Existing accounts and history were not changed. All 20 ordinary-session hosted API checks pass in 20.21 seconds, including the five new registration scenarios; all 16 safe-error unit tests pass. The catalog export now includes six tables and eight RPCs, including the composite membership return; generated types were refreshed from the actual hosted catalog.

### GitHub Pages documentation checked — October 18, 2026

- [Vite static deployment](https://vite.dev/guide/static-deploy.html): the installed Vite 8.3.4 app needs `base: '/supplyloop/'` for this project path; build and publish `dist`, rather than running the development or preview server in production.
- [GitHub Pages site creation](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) and [custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages): use a project repository and a build/deploy workflow, with only the static build artifact published. Free accounts require a public repository; public source disclosure requires the user's pending choice.
- [GitHub Pages API](https://docs.github.com/en/rest/pages/pages): configure this project's `build_type` as `workflow`, retaining the existing root website configuration.
- [Supabase signup](https://supabase.com/docs/reference/javascript/auth-signup), [Auth configuration](https://supabase.com/docs/guides/auth/general-configuration), [Before User Created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook), and [SMTP](https://supabase.com/docs/guides/auth/auth-smtp): account creation and authorized school membership are separate responsibilities. External email verification/invitations require a configured email provider; the proposed immediate demo must be described accurately.
- [Supabase Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing): low activity over seven days can pause the backend. The owner must check availability before judging or explicitly approve a paid plan; no billing change or recurring automation is authorized by this implementation.

## Current verification checkpoint

Independent checks pass: type checking, lint, production build, all 15 error-boundary unit tests, and all 14 ordinary-session hosted API scenarios. The hosted suite took 24.67 seconds and reported no failures, cancellations, or skips. Earlier attempts blocked by sandbox access or approval timeouts ran no assertions; they are not backend failures. The later successful run verifies actual Auth/PostgREST behavior.

After the user changed recipient eligibility to students only, forward migration `20261018000200_student_only_recipients.sql` was reviewed, locally validated, and applied to the same hosted project. The updated hosted suite passed all 15 scenarios in 13.24 seconds, including both-school manager reservation denial with unchanged stock/history and successful student reservations afterward. Isolated PostgreSQL tests additionally verified recipient promotion/deactivation, legacy records, role changes during lock waits, and preservation of completed history. The browser verified manager-only navigation on desktop/mobile, student Find/My pickups, enabled student reservation controls, and the unchanged earlier completed pickup. No existing reservations were rewritten or deleted.

The browser walkthrough verified incomplete clothing intake, rejected premature publication, correction and publication, textbook receipt/publication, structured clothing and textbook matching, reservations, refresh persistence, mobile and desktop collection, history, sign-out clearing, and fresh School B isolation. Minimum condition Good included New/Like new/Good and excluded Fair through the actual frontend. Network-loss and delayed-response injection remain unperformed.

The frontend now requires inventory review after uncertain intake outcomes, guards late dialog completions, and restores opener/fallback focus. Independent source review found no blocking defect; browser checks verified Escape and close-after-refetch focus behavior.

The dashboard download did not yield a usable types artifact. A read-only hosted PostgreSQL catalog query instead exported six tables, 65 columns, 13 foreign keys, and initially seven RPCs into `supabase/schema-catalog.json`. The registration extension refreshed it to eight RPCs, including catalog-derived composite result fields. The Node-only generator produces `src/lib/database.generated.types.ts`; `database.types.ts` preserves its defaults, relationships, and RPC signatures while narrowing CHECK-backed row vocabularies with compile-time assignability constraints. RPC nullability stays conservative and returned mutations/enrollment undergo runtime validation.
