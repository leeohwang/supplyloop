# SupplyLoop verification

The October 18 sections below are historical evidence for the former autoconfirmed registration flow. The current October 23 deployment, activated email configuration, and remaining real-inbox checks are recorded separately at the end.

Verified against dedicated fictional Supabase project `myyfdtqpeqbhnxwlpkeg`, PostgreSQL 17.11. No production or real student data was used.

## October 18 automated checks — historical

| Check | Result |
| --- | --- |
| `npm run check` | Passed |
| `npm run lint` | Passed |
| `npm test` | 16 passed; no failures or skips |
| `npm run build` | Passed |
| `npm run test:api` | 20 passed; no failures, cancellations, or skips; 20.21 seconds |

The API suite uses ordinary authenticated sessions. It verifies school and ownership isolation, manager-only access, anonymous/private-schema denial, direct-table-write denial, JSON/null validation, both categories, exact matching, condition ranking, competing reservations with exactly one winner, cancellation/release, terminal transitions, pickup attribution/idempotency, audit history, rollback, and local sign-out scope. Receipt, correction, publication, and first pickup events are checked for server actor attribution. See `tests/README.md` for setup.

The student-only policy adds direct API checks in both schools: manager reservations return `SL002` without changing item/staff/reservation/event snapshots; students can subsequently reserve the same objects. Missing and wrong-school targets retain identical `SL003` failures. Isolated PostgreSQL 17.11 checks additionally covered promoted/inactive recipients, pre-policy manager allocations, role changes during lock waits, and unchanged completed history. Those operator-fixture cases were not performed through privileged mutations of the hosted demo.

Five registration scenarios also passed against the October 18 hosted backend: account creation alone revealed no school data; anonymous/private-state access was denied; wrong codes and blank labels created no membership; all six fixed accounts retained their memberships; editable Auth metadata and extra RPC arguments could not select a role or school; concurrent enrollment and retries preserved one School A student membership; School B/private data stayed hidden; and the registered student completed a manager-confirmed pickup. The private code was absent from Auth user/identity responses. These runs used the former autoconfirmed flow and do not establish mailbox ownership or acceptance of the new email-confirmation release. Their fictional Auth accounts and enrollment/history were retained.

Historical evidence before registration: the 15-scenario core suite passed in 13.24 seconds after the student-only migration, and 15 error-normalization unit cases passed. The October 18 20-scenario/16-unit results above superseded those earlier counts. Earlier network-restricted attempts failed during setup and executed no assertions. Tests retain uniquely labeled fictional QA objects and history; no reset was performed.

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

## October 18 schema and credential checks — historical

The hosted database exposes six public application tables with RLS enabled and eight public RPCs: seven inventory/reservation operations and `join_demo_school`. Registration also adds two unexposed private tables with RLS and revoked ordinary-role table access. Migrations `20261018000100`, `20261018000200`, and `20261018000300` were applied manually through SQL Editor. The third migration's verified SHA-256 is `1c13868cb257122ed11d095ee1d7cf689bcd8c35935af0acc6c435ad271af9b2`. The constrained application owner has no global RLS bypass.

Private hashed enrollment configuration was installed. At that point, email/password signup was enabled with email confirmation disabled; anonymous sign-in and manual identity linking were disabled. The approved exact Auth URL allowlist was configured. Signup created an actual Auth account without verifying email ownership; only the private code granted School A student membership. That autoconfirmation setting has since been replaced by the October 23 configuration below. Provisioning originally created two fictional schools, six fixed-role users, memberships, and eleven starter objects. Registration and browser/API checks have added fictional accounts and records, so those initial counts do not describe current totals. No cleanup or historical rewrite was performed.

`supabase/schema-catalog.json` is the refreshed catalog-only export from the hosted PostgreSQL server, containing six public tables, 65 columns, 13 foreign keys, and eight RPCs. It excludes private configuration and application/account rows. The offline generator reproduces `src/lib/database.generated.types.ts`; the application wrapper narrows reviewed row vocabularies and runtime-validates operation results.

Private operator and test credentials stay in ignored owner-only local environment files. The browser uses only the publishable key and the signed-in user's session.

## October 18 public release walkthrough — historical

The GitHub Pages app at `https://leeohwang.github.io/supplyloop/` was verified on October 18, 2026. Initial commit `325f4af3bffe9ee83510a443f7f9edf81e14cc89` and mobile-layout fix `d637ddc2ea5eef4b27c7e02a185d9f6f950b76ae` both passed GitHub's build/deploy workflow. The [mobile-fix run](https://github.com/leeohwang/supplyloop/actions/runs/39166150609) completed successfully. HTTPS returned HTTP 200; public entry loaded without a GitHub login. Published assets use `/supplyloop/assets/`, and Pages enforces HTTPS. Deployment is restricted to the `main` branch and uploads only `dist`.

- Fresh public-origin signup created an actual account with no school workspace. An incorrect code showed a safe rejection and no student controls; refresh retained the signed-in account and enrollment step. The valid private code created a School A student membership, which survived refresh and a fresh sign-in.
- The fixed School A manager login opened Manager desk only. A fresh sweater was received, inspected, and published. The newly registered student found/reserved it and saw an active pickup. The manager confirmed collection, and a subsequent student login showed the completed pickup and server timestamp.
- A fixed School B student login showed School B, student navigation, no manager controls, and no School A review item.
- A second real signup/enrollment succeeded at 390 × 844 viewport dimensions. Long fictional email text and the registration form fit the phone width. A pickup-card overflow discovered during this walkthrough was fixed with shrinkable text and line wrapping; the published retest measured document width and scroll width both 375 pixels, with the card ending at 355 pixels. Full item codes remain visible.
- No browser console warnings/errors were observed in the deployed walkthrough. Test accounts and the new item's audit history were retained; no stock reset occurred.
- Exact staged source and compiled assets were scanned against private credential values before publishing. Operator keys, judge passwords, and the enrollment code were absent. Private handoff files remain ignored and owner-only.

## Limits and remaining decisions

Network loss and deliberately delayed responses were not injected in a real browser. The October 23 actual-SDK unit suite now supplies additional simulated timing evidence, including shared-profile account changes and delayed SDK persistence; its scope is described below. The complete browser failure UI and timing behavior remain unverified under deliberate network faults. Phone viewport testing does not establish behavior on every physical mobile browser or on another physical network.

The October 18 GitHub Pages deployment and public browser/registration checks completed for the former flow. The current release still needs the real-email and public handoff checks listed below. The backend remains on the approved Supabase Free plan, which can pause after seven days of low activity; the owner should verify availability before judging or explicitly select a paid plan. No upgrade or recurring automation was created. Optional unmet needs and shortage summaries are outside this core implementation. Real-school onboarding, privacy, retention, operational inspection, and pickup policy require human decisions before a real pilot.

## October 23 email-confirmation release — activated, inbox acceptance pending

The email upgrade is deployed at the public `/supplyloop/` address. Resend verified the owned sending domain, and the required Cloudflare records are installed. Custom SMTP was saved and its persistence checked: sender **SupplyLoop <noreply@auth.joinsupplyloop.app>**, Resend port **465**, with TLS enforced. Both the signup-confirmation and magic-link code templates are installed. Email/password signup and **Confirm Email** are enabled and their saved state was checked after reloading. Codes use eight digits, a one-hour lifetime, and a 60-second resend interval.

Supabase's new-password minimum is twelve; all six existing fixed passwords meet that length and were not changed. The Site URL and sole allowed redirect are the exact published `/supplyloop/` address. Fixed judge accounts retain the ordinary password sign-in route with no email-confirmation wait. New School A enrollment requires recent email-OTP proof and the private community code. Earlier autoconfirmed accounts are not treated as proof of mailbox ownership.

The exact fourth migration, `20261023000100_email_confirmed_enrollment.sql`, was applied with SHA-256 `6acce7917a7cdd8703cbdc72c042003537a2d47fe4c6eb82e9d9fcccc6021174`. All nine pre/post table row-count and digest comparisons matched. Catalog checks passed for three reviewed functions, six RLS-enabled public tables, and eight public RPCs. This confirms the reviewed schema/configuration and preserved existing data; it does not prove delivery to a mailbox.

| Release check | Result and scope |
| --- | --- |
| `npm run check` | Passed on the exact materialized candidate |
| `npm run lint` | Passed on that candidate |
| `npm test` | 42 passed: 17 error boundaries and 25 actual-SDK lifecycle cases; no failures/cancellations/skips |
| `npm run build` | Passed; approximately 513 kB main JavaScript chunk, 144 kB gzip; nonblocking Vite size advisory |
| Compiled private-value scan | Three built files, sixteen private configuration values checked, explicitly including the operator secret key, zero matches |
| Staged public source scan | 70 indexed blobs compared with sixteen private configuration values; zero credentials or private emails found. Only the documented local session-file locator matched in two documentation/example paths |
| Core hosted API baseline | 15 passed with ordinary authenticated sessions before email cutover |
| Core hosted API after migration | 15 passed in 17.61 seconds with ordinary authenticated sessions; no failures/cancellations/skips |
| Isolated PostgreSQL 17.11 enrollment checks | Passed independently by implementation and QA, including strict recent OTP claims, helper permissions, preserved memberships, and concurrent enrollment |
| Pages CI and deployment | [Run 40039871848](https://github.com/leeohwang/supplyloop/actions/runs/40039871848) passed checks, 42 units, and build for `ec1ca9a4d0db97269df3a319eaf1bb2872c6a416` |
| Published artifact comparison | All three live HTML/JavaScript/CSS files were byte-identical to the tested build |
| Updated enrollment suite | Five real-OTP-session scenarios prepared; pending actual signup, delivered code, and controlled verified session |

The source-level late-verification issue was reproduced with the actual pinned Supabase SDK and fake transport. The fix coordinates complete explicit SDK actions across tabs, guards stale headers/body responses, and accepts the authoritative session only after settlement. Tests cover persistence windows, signup returning no session, queued timeouts and recovery, ordinary refresh, unsupported primitives, independent Auth transport deadlines, and local-only logout recovery. A disposable prior-settlement-policy control failed the targeted queued-timeout test. These tests send no real email and use no real credential or backend request; they do not establish real inbox delivery or browser network injection.

The rebuilt static preview was tested against the real hosted backend. School A student sign-in opened Find/My pickups; School A manager sign-in opened only Manager desk, and manager login survived refresh. A second tab shared the authorized session and sign-out cleared private views across tabs. A fresh School B student sign-in showed School B, student navigation, its catalog and personal pickups, and no old School A account context or manager navigation. The phone layout measured a 375-pixel document/content width at a 390 × 844 viewport, with no horizontal document overflow. The confirmation-recovery panel opened and focused its heading; code input uses eight digits and one-time-code autocomplete, and registration alone enforces the twelve-character client minimum. No new account or email was requested during these preview checks. Test logins were signed out and temporary browser pages were closed afterward.

The current evidence establishes configuration persistence, schema preservation, automated checks, deployment, and the preview behavior described above. **Actual signup, delivery to the controlled inbox, code entry/resend/verification, the five hosted recent-OTP registration scenarios, and the complete public-origin student/manager handoff remain pending.** The owner is providing the password privately for that walkthrough; no password or confirmation code belongs in this record. These remaining checks are required before the new release is called ready for recording. Browser checks do not establish every physical device/network; ordinary access tokens retain their configured lifetime after sign-out, and a local-only recovery cannot prove server-side revocation.
