# SupplyLoop

A school community prototype for finding, reserving, and collecting donated clothing and reusable physical textbooks. Built with React, TypeScript, Vite, and Supabase Auth/PostgreSQL. Schools, inventory, and fixed-role test identities are fictional; reviewer registration creates real authentication accounts.

The core flow is manager intake and inspection → available catalog → member reservation → manager-confirmed pickup. Each item represents one physical object. The database enforces school isolation, roles, state transitions, and atomic reservations.

## Current checkpoint

The app is live at **https://leeohwang.github.io/supplyloop/**, connected to the dedicated `supplyloop-demo` backend (`myyfdtqpeqbhnxwlpkeg`, North Virginia, PostgreSQL 17.11). Six public application tables have RLS enabled, eight RPCs are installed, and the six original fictional accounts remain available. Real demo registration creates an email/password account, then grants School A student access only after checking a private code. Email ownership and school identity are explicitly unverified for this demo. All 20 hosted API scenarios and 16 unit tests pass, with public desktop and phone-sized registration/hand-off verification. Managers use Manager desk only; students reserve and receive items. See [verification evidence and limits](docs/verification.md) and [judge access](docs/judge-access.md).

**October 23 source upgrade, activation pending:** the next release adds actual emailed confirmation through Resend before new school enrollment, including older autoconfirmed accounts without memberships. The sending domain is verified and the frontend/database changes are prepared; the owner's private SMTP-key entry, coordinated hosted activation, and real inbox acceptance are still required. Existing memberships and fixed logins are preserved. Today's core API baseline passes 15 scenarios; the updated source passes 42 unit tests, type checking, lint, and a production build. Delayed authentication and interrupted logout are covered against the pinned SDK with simulated transport; this does not prove real email delivery. See [integration status](docs/implementation-notes.md#email-confirmation-integration--october-23-2026).

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

New reviewers can use **Register for demo**, create a real email/password account, then enter a fictional display label and the organizer's private School A enrollment code. The code is in ignored, owner-only `.env.registration.local`; it must be handed to approved reviewers privately, alongside the fixed judge login details in `.env.test.local`. The local `JUDGE-ACCESS.private.local` handoff combines only these judge credentials, code, URL, and instructions; it contains no operator key and stays outside Git. No email is sent or verified. An account without a valid enrollment has no school access. A previously created account can sign in and resume enrollment; retrying enrollment preserves its original membership. See [registration setup](supabase/README.md) and [judge walkthrough](docs/judge-access.md).

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
