# SupplyLoop

A school community prototype for finding, reserving, and collecting donated clothing and reusable physical textbooks. Built with React, TypeScript, Vite, and Supabase Auth/PostgreSQL. Schools, inventory, and fixed-role test identities are fictional; reviewer registration creates real authentication accounts.

The core flow is manager intake and inspection → available catalog → member reservation → manager-confirmed pickup. Each item represents one physical object. The database enforces school isolation, roles, state transitions, and atomic reservations.

## Current checkpoint

The website's canonical address is **https://joinsupplyloop.app/**, hosted as a static Cloudflare Pages site. The approved public `leeohwang/supplyloop` repository retains source and validation CI. See [domain cutover evidence](docs/verification.md#website-domain-cutover--october-23-2026) for activation and retirement status. The app remains connected to the dedicated `supplyloop-demo` backend (`myyfdtqpeqbhnxwlpkeg`, North Virginia, PostgreSQL 17.11). Six public application tables have RLS enabled, eight RPCs are installed, and the six original fictional accounts remain available. New registration requires an email/password account, a personal emailed confirmation code, and the separate private School A join code. School identity remains unverified. Managers use Manager desk only; students reserve and receive items. See [verification evidence and limits](docs/verification.md) and [judge access](docs/judge-access.md).

**October 23 domain cutover:** the apex serves the tested three-file build over valid HTTPS. Fresh student/manager sign-in, reserve/cancel with history, refresh, School B separation, cross-tab sign-out, and desktop/phone checks passed. The old app and its assets return 404; the separate LUMEN root website is unchanged. Both hosted email links and the exact Auth URL now use the apex. Future publication is a manual Cloudflare upload after source validation; see [owner instructions](docs/judge-access.md#repository-owner-verification-and-manual-publication).

**Earlier October 23 integration evidence:** actual Gmail signup and code entry succeeded before the website move; an explicit fresh-code request arrived, and ordinary Auth requests rejected a mutated code, accepted the correct code once, then rejected reuse. All 20 hosted API scenarios passed: 15 core checks plus five recent-OTP enrollment scenarios. The public clothing/textbook handoff, refresh persistence, cancellation/re-reservation, completed history, School B isolation, shared-profile sign-out, keyboard focus, and phone layout also passed. Existing memberships and fixed logins are preserved; nine migration-boundary database digests matched. The apex uses the identical JavaScript/CSS and unchanged backend; the full signup/handoff/API suites were not repeated for this origin-only move. The new root-path build passed type checking, lint, all 42 unit tests, build, and private-value scanning. Earlier autoconfirmed accounts do not prove mailbox ownership. See [verification evidence](docs/verification.md) and [integration status](docs/implementation-notes.md#email-confirmation-integration--october-23-2026).

**October 23 Outlook recovery and apex enrollment:** Microsoft had quarantined the confirmation as phishing despite passing SPF, DKIM, DMARC, and composite authentication. The owner approved release and false-positive reporting; the message reached Inbox and its real code verified on the apex. A subsequent verification email arrived in Inbox automatically at 10:01 p.m. Eastern, with no second release or sender allowlist. Wrong email and school codes were denied; the valid private code granted School A student access, and a second-tab enrollment retry preserved the original membership/label. Refresh and cross-tab sign-out passed. This covers one controlled Microsoft 365 mailbox and resumes an existing unconfirmed account; the earlier Gmail password-signup proof remains separately scoped. See [the current email acceptance record](docs/verification.md#outlook-recovery-and-apex-enrollment--october-23-2026). Fixed judge accounts require no email wait. Deliberate browser network-fault injection remains untested.

## Run locally

Use Node 22.20.0 or a compatible version meeting the manifest's engine requirement, with npm.

```sh
npm ci
cp .env.example .env.local
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` to the approved project's public connection values. These values are included in the browser bundle. Keep server-only keys out of every `VITE_*` variable.

```sh
npm run dev -- --port 5173 --strictPort
```

Open the localhost URL printed by Vite. For a production-build preview:

```sh
npm run build
npm run preview
```

Use a current browser with Web Locks, `AbortSignal.any`, and shared site storage enabled. The app coordinates account changes across tabs in the same browser profile and refuses unsafe fallback when coordination is unavailable. Reload older app tabs after an upgrade. New passwords require at least 12 characters; the six existing fixed credentials are unchanged.

## Demo accounts and inventory

The prepared `.env.operator.local` file is ignored by Git. Enter the approved project's server-only key there, alongside its URL and publishable key. Review [the provisioner](scripts/operator/provision.mjs) and [backend setup notes](supabase/README.md), then run:

```sh
node --env-file=.env.operator.local scripts/operator/provision.mjs --check
npm run demo:provision
```

The script is restricted to the approved demo project. It creates School A and School B, one manager and two members per school, and eleven starter objects. It writes generated account credentials to ignored `.env.test.local` with owner-only permissions and does not print them. Open that local file to obtain test sign-in details; do not paste credentials into chat or commit them. Existing account passwords and reservation history are preserved on ordinary reruns.

Managers open directly to Manager desk to receive drafts, complete details, inspect and publish stock, release reservations, and confirm student collection. Students use Find and My pickups. Managers cannot reserve or receive items personally; the database enforces this as well as the interface. Sign-out ends the current browser session; independent signed-in sessions remain usable.

New reviewers can use **Register for demo**, create a real email/password account, enter the personal eight-digit emailed code, then enter a fictional display label and the organizer's private School A enrollment code. The personal code expires after one hour; it is separate from the community code. The community code is in ignored, owner-only `.env.registration.local`; it must be handed to approved reviewers privately, alongside the fixed judge login details in `.env.test.local`. The local `JUDGE-ACCESS.private.local` handoff combines only these judge credentials, code, URL, and instructions; it contains no operator key and stays outside Git. An account alone grants no school access. An older unenrolled account must request a fresh emailed code before first joining. Existing enrollments remain usable after password sign-in, and retries preserve the original membership. See [registration setup](supabase/README.md) and [judge walkthrough](docs/judge-access.md).

Each physical item has a unique ID, a school, a current status, and a manager-only storage code. A reservation links that item to its student recipient. Collection records the confirming manager and server timestamp; event history preserves receipt, publication, reservation, release/cancellation, and collection. This tracks the assigned recipient and confirmed handoff, not an item's physical location after collection. Current demo collection happens at Main office pickup.

Restoring fictional inventory is a separate, explicit operator action. See [restoration instructions](supabase/README.md#fictional-data-restoration-and-security). There is no public reset or role-administration interface.

## Verification

```sh
npm run check
npm run lint
npm test
npm run build
```

Once account provisioning has produced `.env.test.local`, run the hosted acceptance suite:

```sh
npm run test:api
```

That command runs the 15 core scenarios without sending email. The email-confirmation release separates its five enrollment scenarios so ordinary checks never sign up generated email addresses. Copy `.env.email-test.example` to private `.env.email-test.local`, select an inbox you control, and follow [the controlled email-session recipe](tests/EMAIL_CONFIRMATION.md) before running `npm run test:registration`. The controlled account must remain unenrolled until that suite runs. `npm run test:enrollment-security` runs the isolated PostgreSQL regression harness; it never connects to the hosted database.

API tests sign in as ordinary fictional accounts, including two concurrent reservation requests. They create labeled QA items and leave their history in the demo. They never use the operator key or reset existing records. See [test coverage and browser checks](tests/README.md).

## Project references

- [Agent working agreement](AGENTS.md): scope, documentation requirements, clarification rules, ownership, and acceptance criteria.
- [Architecture reference](supplyloop-architecture.md): the supplied design document.
- [Backend contract](docs/backend-contract.md): data fields, operations, errors, and security invariants.
- [Implementation notes](docs/implementation-notes.md): approved decisions, environment inspection, and official documentation sources.
- [Verification record](docs/verification.md): completed checks, browser scenarios, and remaining limits.
- [Backend setup](supabase/README.md): migration status, provisioning, CLI history, and restoration.

The hosted initial migration was applied manually through SQL Editor. Do not replay it against this project. Follow the backend notes to reconcile migration history before adopting the Supabase CLI for later changes.
