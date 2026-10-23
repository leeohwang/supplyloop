# SupplyLoop verification

The October 18 sections below describe the deployed demo. The October 23 candidate and its remaining activation checks are recorded separately at the end.

Verified against dedicated fictional Supabase project `myyfdtqpeqbhnxwlpkeg`, PostgreSQL 17.11. No production or real student data was used.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run check` | Passed |
| `npm run lint` | Passed |
| `npm test` | 16 passed; no failures or skips |
| `npm run build` | Passed |
| `npm run test:api` | 20 passed; no failures, cancellations, or skips; 20.21 seconds |

The API suite uses ordinary authenticated sessions. It verifies school and ownership isolation, manager-only access, anonymous/private-schema denial, direct-table-write denial, JSON/null validation, both categories, exact matching, condition ranking, competing reservations with exactly one winner, cancellation/release, terminal transitions, pickup attribution/idempotency, audit history, rollback, and local sign-out scope. Receipt, correction, publication, and first pickup events are checked for server actor attribution. See `tests/README.md` for setup.

The student-only policy adds direct API checks in both schools: manager reservations return `SL002` without changing item/staff/reservation/event snapshots; students can subsequently reserve the same objects. Missing and wrong-school targets retain identical `SL003` failures. Isolated PostgreSQL 17.11 checks additionally covered promoted/inactive recipients, pre-policy manager allocations, role changes during lock waits, and unchanged completed history. Those operator-fixture cases were not performed through privileged mutations of the hosted demo.

Five registration scenarios now also pass against the hosted backend: account creation alone reveals no school data; anonymous/private-state access is denied; wrong codes and blank labels create no membership; all six fixed accounts retain their memberships; editable Auth metadata and extra RPC arguments cannot select a role or school; concurrent enrollment and retries preserve one School A student membership; School B/private data stays hidden; and the registered student completes a manager-confirmed pickup. The private code is absent from Auth user/identity responses. A uniquely addressed fictional Auth account and its enrollment/history are retained by each run.

Historical evidence before registration: the 15-scenario core suite passed in 13.24 seconds after the student-only migration, and 15 error-normalization unit cases passed. The current 20-scenario/16-unit results above supersede those counts. Earlier network-restricted attempts failed during setup and executed no assertions. Tests retain uniquely labeled fictional QA objects and history; no reset was performed.

## Earlier core browser walkthrough

The local Vite interface returned HTTP 200 and was tested against the real backend in the in-app browser. This evidence covers the core workflows before the registration extension. It does not verify the new registration/enrollment forms, their mobile behavior, or the public GitHub Pages deployment.

- School A manager saved an incomplete clothing draft. Publication failed safely with incomplete details; correction and inspection then published it successfully.
- The manager received a reusable physical textbook with explicit code/workbook checks and published it after inspection.
- A member used actual clothing filters: the wrong size produced no matches; the correct garment, size, and variant matched. Minimum condition Good included New, Like new, and Good, excluding Fair.
- The actual textbook filters excluded the wrong edition and ISBN, then returned the exact ISBN/edition copy.
- The member reserved both objects. Reservation details and the signed-in session survived refresh.
- The manager confirmed the clothing pickup on desktop and textbook pickup at 390 × 844 viewport dimensions. Queue entries disappeared and server-recorded history showed the correct manager/member actions.
- A later member login displayed both objects as completed, with the collection timestamps.
- Sign-out removed private manager controls. A fresh School B login showed only School B and its own catalog, without School A's newly created objects or manager controls.
- Phone-sized sign-in, item details, reservation, personal pickups, manager intake form, and collection controls were exercised. No horizontal document overflow was observed. Escape restored the dialog opener; closing after a refetch used the main-content fallback.
- No browser console warnings or errors were observed in the final check.
- Following the student-only policy change, fresh manager sign-in opened directly to Manager desk on desktop and phone-sized layouts, with no Find, My pickups, or reservation controls. Student sign-in retained Find/My pickups and enabled reservation controls. An earlier completed pickup kept its original recipient and collection timestamp.

## Schema and credential checks

The hosted database exposes six public application tables with RLS enabled and eight public RPCs: seven inventory/reservation operations and `join_demo_school`. Registration also adds two unexposed private tables with RLS and revoked ordinary-role table access. Migrations `20261018000100`, `20261018000200`, and `20261018000300` were applied manually through SQL Editor. The third migration's verified SHA-256 is `1c13868cb257122ed11d095ee1d7cf689bcd8c35935af0acc6c435ad271af9b2`. The constrained application owner has no global RLS bypass.

Private hashed enrollment configuration is installed. Email/password signup is enabled with email confirmation disabled for this fictional demo; anonymous sign-in and manual identity linking remain disabled. The approved exact Auth URL allowlist is configured. Signup creates an actual Auth account without verifying email ownership; only the private code grants School A student membership. Provisioning originally created two fictional schools, six fixed-role users, memberships, and eleven starter objects. Registration and browser/API checks have added fictional accounts and records, so those initial counts do not describe current totals. No cleanup or historical rewrite was performed.

`supabase/schema-catalog.json` is the refreshed catalog-only export from the hosted PostgreSQL server, containing six public tables, 65 columns, 13 foreign keys, and eight RPCs. It excludes private configuration and application/account rows. The offline generator reproduces `src/lib/database.generated.types.ts`; the application wrapper narrows reviewed row vocabularies and runtime-validates operation results.

Private operator and test credentials stay in ignored owner-only local environment files. The browser uses only the publishable key and the signed-in user's session.

## Public release walkthrough

The GitHub Pages app at `https://leeohwang.github.io/supplyloop/` was verified on October 18, 2026. Initial commit `325f4af3bffe9ee83510a443f7f9edf81e14cc89` and mobile-layout fix `d637ddc2ea5eef4b27c7e02a185d9f6f950b76ae` both passed GitHub's build/deploy workflow. The [mobile-fix run](https://github.com/leeohwang/supplyloop/actions/runs/39166150609) completed successfully. HTTPS returned HTTP 200; public entry loaded without a GitHub login. Published assets use `/supplyloop/assets/`, and Pages enforces HTTPS. Deployment is restricted to the `main` branch and uploads only `dist`.

- Fresh public-origin signup created an actual account with no school workspace. An incorrect code showed a safe rejection and no student controls; refresh retained the signed-in account and enrollment step. The valid private code created a School A student membership, which survived refresh and a fresh sign-in.
- The fixed School A manager login opened Manager desk only. A fresh sweater was received, inspected, and published. The newly registered student found/reserved it and saw an active pickup. The manager confirmed collection, and a subsequent student login showed the completed pickup and server timestamp.
- A fixed School B student login showed School B, student navigation, no manager controls, and no School A review item.
- A second real signup/enrollment succeeded at 390 × 844 viewport dimensions. Long fictional email text and the registration form fit the phone width. A pickup-card overflow discovered during this walkthrough was fixed with shrinkable text and line wrapping; the published retest measured document width and scroll width both 375 pixels, with the card ending at 355 pixels. Full item codes remain visible.
- No browser console warnings/errors were observed in the deployed walkthrough. Test accounts and the new item's audit history were retained; no stock reset occurred.
- Exact staged source and compiled assets were scanned against private credential values before publishing. Operator keys, judge passwords, and the enrollment code were absent. Private handoff files remain ignored and owner-only.

## Limits and remaining decisions

Network loss and deliberately delayed responses were not experimentally injected. Their handling has source-review evidence and error-normalization unit coverage; the complete failure UI and timing behavior remain unverified under those conditions. The Supabase SDK's shared-profile, cross-tab ordering of delayed sign-in/signup responses is also unverified; guarded component callbacks do not establish cancellation of SDK session changes. Phone viewport testing does not establish behavior on every physical mobile browser or on another physical network.

GitHub Pages deployment and public browser/registration checks are complete. The backend remains on the approved Supabase Free plan, which can pause after seven days of low activity; the owner should verify availability before judging or explicitly select a paid plan. No upgrade or recurring automation was created. Optional unmet needs and shortage summaries are outside this core implementation. Real-school onboarding, privacy, retention, operational inspection, and pickup policy require human decisions before a real pilot.

## October 23 email-confirmation candidate — activation pending

The email upgrade is prepared and has not replaced the deployed October 18 flow. Resend verified the owned sending domain, and the required Cloudflare records are installed. Supabase's new-password minimum was raised to twelve, saved, and verified; all six existing fixed passwords meet that length and were not changed. The Site URL and sole allowed redirect are the exact published `/supplyloop/` address. Actual custom SMTP activation still requires the owner's private restricted key entry. No mailbox confirmation, live email-template change, fourth hosted migration, or new public deployment is claimed complete.

| Candidate check | Result and scope |
| --- | --- |
| `npm run check` | Passed on the exact materialized candidate |
| `npm run lint` | Passed on that candidate |
| `npm test` | 42 passed: 17 error boundaries and 25 actual-SDK lifecycle cases; no failures/cancellations/skips |
| `npm run build` | Passed; approximately 513 kB main JavaScript chunk, 144 kB gzip; nonblocking Vite size advisory |
| Compiled private-value scan | Three built files, sixteen private configuration values checked, explicitly including the operator secret key, zero matches |
| Core hosted API baseline | 15 passed with ordinary authenticated sessions before email cutover |
| Isolated PostgreSQL 17.11 enrollment checks | Passed independently by implementation and QA, including strict recent OTP claims, helper permissions, preserved memberships, and concurrent enrollment |
| Updated enrollment suite | Five real-OTP-session scenarios prepared; pending controlled inbox/session and hosted cutover |

The source-level late-verification issue was reproduced with the actual pinned Supabase SDK and fake transport. The fix coordinates complete explicit SDK actions across tabs, guards stale headers/body responses, and accepts the authoritative session only after settlement. Tests cover persistence windows, signup returning no session, queued timeouts and recovery, ordinary refresh, unsupported primitives, independent Auth transport deadlines, and local-only logout recovery. A disposable prior-settlement-policy control failed the targeted queued-timeout test. These tests send no real email and use no real credential or backend request; they do not establish real inbox delivery or browser network injection.

The rebuilt static preview was tested against the real hosted backend. School A student sign-in opened Find/My pickups; School A manager sign-in opened only Manager desk, and manager login survived refresh. A second tab shared the authorized session and sign-out cleared private views across tabs. A fresh School B student sign-in showed School B, student navigation, its catalog and personal pickups, and no old School A account context or manager navigation. The phone layout measured a 375-pixel document/content width at a 390 × 844 viewport, with no horizontal document overflow. The confirmation-recovery panel opened and focused its heading; code input uses eight digits and one-time-code autocomplete, and registration alone enforces the twelve-character client minimum. No new account or email was requested during these preview checks. Test logins were signed out and temporary browser pages were closed afterward.

This is new-build preview and simulated timing evidence. Real signup/code delivery, resend/verification, hosted recent-OTP enrollment, and the complete public-origin student/manager handoff remain required before the new release is called ready for recording. Earlier autoconfirmed accounts do not prove mailbox ownership. Browser checks do not establish every physical device/network; ordinary access tokens retain their configured lifetime after sign-out, and a local-only recovery cannot prove server-side revocation.
