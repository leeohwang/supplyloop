# SupplyLoop verification

## Account onboarding and reset preparation — October 24, 2026

The current interface uses **Create account → personal emailed confirmation code → Join school with a privately shared code**. The renamed `SchoolEnrollment` component and `joinSchool` client adapter retain the existing `join_demo_school` backend RPC, student-only School A enrollment, real email proof, password recovery, and session coordination. The persistent fictional-data notice remains. No Auth setting, email template, schema, grant, code, or dependency version changed.

| Check | Result |
| --- | --- |
| Frontend validation | Type checking, lint, all 63 unit/SDK tests, and production build passed using exact-lock materialized dependencies outside the iCloud workspace |
| Operator safeguard mocks | Six retained tests passed, including frozen UUID targeting, interruption/retry, new-registration refusal, protected-record drift, and artifact tampering |
| PostgreSQL reset safety | Implementation owner and independent QA passed nine isolated PostgreSQL 17 checks covering changed targets/dependencies, atomic rollback, protected Auth/password/code preservation, success, and replay refusal |
| Local browser | Create account copy and twelve-character constraint present; email-code confirmation remains separate; phone viewport 390 × 844 had client/scroll width 375/375; no obsolete registration label |
| Build privacy | All three compiled files passed a scan against 16 private configured values; ZIP contains only root `index.html` and two compiled assets |
| Public files | Production deployment `000c459a-1c06-471c-a268-9e0dcbfa64d5`; canonical apex and both asset URLs returned HTTPS 200 with correct MIME types and bytes identical to the reviewed build |
| Hosted browser | New account wording and separate email-code explanation observed on the apex after signing out the prior personal session; no new account or email was created |
| Reset plan | Hosted PostgreSQL 17.11 preflight found 11 Auth accounts, six fixed accounts, two schools, 11 memberships, 132 items/staff rows, 64 reservations, 340 events, and five enrollment-ledger rows; trusted SQL read/lock permissions verified |
| Hosted reset | **Prepared, not executed**. The user authorized deleting self-registered accounts and restoring original fictional data; browser rules require final irreversible-deletion confirmation at execution time, which is pending |

Reviewed release ZIP SHA-256: `72f89edbdf44e8c1135b54328c5bbac7386fd9858240170c4dc57e5c682fd0cb`. Public HTML SHA-256: `6b501acac89bfa3025567de4018bc7ae1d90b1d3fa7d42a4a74abcc324a15902`; JavaScript `assets/index-BU-mstk8.js`: `4383f26dd6f1d3fbcf0bea482c351436d10e75e23dd425753461420b8cf999af`; unchanged CSS `assets/index-BhuDatqB.css`: `88284e5112fcb3a8a47f0daf356193c0fbd614f2692e59f5f8b89ef221ec4ae8`.

The frozen owner-only reset artifacts are outside the repository in the materialized operator snapshot. The plan removes five added accounts, preserves the original six Auth identities/passwords/memberships and private code, clears both fictional schools' stock/history, then restores eleven seed objects through manager RPCs. No hosted deletion, new signup, email send, password change, or business RPC has been used for this release's checks so far. Prior real-inbox and authorization acceptance below retain their historical scope. The full mutating acceptance suite should not run after restoration without another authorized reset, because it creates test stock/history.

The password-recovery, Outlook recovery/enrollment, and website-domain checkpoints below record the successive releases. October 18 sections are historical evidence for the former autoconfirmed registration flow. The earlier October 23 email-confirmation/public-walkthrough section retains its previous GitHub Pages scope and is supplemented by the actual apex email/enrollment checks below.

Verified against dedicated fictional Supabase project `myyfdtqpeqbhnxwlpkeg`, PostgreSQL 17.11. School identities, inventory, labels, and pickup records are fictional; controlled registration uses real email accounts.

## Password recovery — October 23, 2026

The apex now has **Forgot password → Send reset code → Verify reset code → Save new password → ordinary sign-in**. **I have a reset code** supports entering an already received code without replacing it. Supabase handles the recovery request, `verifyOtp` with `type: 'recovery'`, and the password update; the existing Resend SMTP sender and TLS configuration are unchanged. No database migration, role change, or membership write is part of recovery.

The recovered actor is checked against both the stored session and a live Auth user before updating the password. Recovery purpose stays attached to the accepted session across refresh/shared tabs; school screens do not mount during recovery or account reconciliation. The complete SDK password update and global sign-out run under the shared account-action lock with supersession/transport guards. Successful update returns to sign-in; a failed global logout reports any local-only fallback. Cancellation clears the current browser session. Lost update responses are treated as uncertain, with no automatic password retry. Existing access JWTs can remain valid until their normal expiry.

| Release check | Result and scope |
| --- | --- |
| Type checking, lint, unit tests, production build | Passed from the isolated, source-matched build snapshot; **63 unit/SDK cases**, zero failures/cancellations/skips. The 21 additions exercise actual pinned SDK behavior against fabricated transport/session responses, not a hosted password change |
| Template installation | Reset password template saved and reopened: approved subject, one Token placeholder, eight-digit/one-hour wording, only the code instructions and canonical apex link |
| Existing email-template regression | Signup confirmation and existing-account OTP previews retain their code instructions and one canonical apex link; neither template was changed in this release |
| Artifact/private-value scan | 73 public files, 17 private values, 34 build inputs, and 3 compiled files checked; zero credentials/private-email exposure or stale hosting paths |
| Production upload | Cloudflare Pages production deployment `a4c336b1-8194-4a5c-b87e-fc5221ec4d54`, reviewed ZIP SHA-256 `94256d7ee75b52a185ee45ecd957dbf8e987851f1005ec2bf54d8a548618e096` |
| Independent HTTPS verification | At **02:47:51 UTC October 24 (October 23 EDT)**, all three assets matched the reviewed manifest over valid HTTPS with correct MIME/root paths; old project remained a direct 404 and the separate LUMEN root was byte-identical |
| Public reset request | One explicit request for the owner's existing account returned the neutral check-your-inbox response and displayed the resend countdown |
| Actual Outlook reset-email delivery | All-folders sender/subject search showed **Your SupplyLoop password reset code**, **Inbox**, **10:49 p.m. EDT**; nothing was selected/opened and no quarantine release was performed |
| Wrong recovery code | Rejected with the invalid/expired/used-code error; no password form or school workspace opened |
| Fixed-account regression after deployment | All six ordinary password logins/live-user checks, original membership/role/active/label checks, single-school reads, and temporary-session local sign-outs passed; no password update or business RPC was used |
| Real recovery and new-password acceptance | The owner confirmed completing the real reset-code/new-password flow and ordinary sign-in privately. The lead independently observed the School A student Find/My pickups workspace in two apex tabs and after refreshing the reopened tab at approximately **11:15 p.m. EDT**. No manager screen appeared; no fixed demo password was reset |

The public JavaScript is `assets/index-Dkx_xM8q.js`, **523,132 bytes**, SHA-256 `cf515eb3d47306e59e7401d4bfa43731a608378e9afca768dc576ff161c947b2`. HTML SHA-256 is `3e01df598bce28705f75a4330a774e3043e95bfa819e6d5e1c2ac1eca9b74b8d`; CSS retains `88284e5112fcb3a8a47f0daf356193c0fbd614f2692e59f5f8b89ef221ec4ae8`. Vite emits its existing greater-than-500-kB chunk warning; the build succeeds. Original dependency manifests and pinned versions are unchanged. Original-folder compiler attempts stalled and were stopped; reported successful checks use the isolated snapshot with all 34 source/build hashes verified against the working tree.

Current official sources were read on **October 23, 2026**, for React 19.3.1, TypeScript 6.0.2, Vite 8.3.4, Supabase JS/auth-js 2.118.0, hosted Auth 2.197.0, and PostgreSQL 17.11: [React effects](https://react.dev/reference/react/useEffect), [TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html), [Vite build/deployment](https://vite.dev/guide/static-deploy.html), [Supabase recovery request](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [verification](https://supabase.com/docs/reference/javascript/auth-verifyotp), [password update](https://supabase.com/docs/reference/javascript/auth-updateuser), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [Resend SMTP](https://resend.com/docs/send-with-supabase-smtp), [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), and [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/). Version-specific session/token behavior and server rate limits are documented in [backend recovery setup](../supabase/README.md#password-recovery-preparation--october-23-2026).

## Outlook recovery and apex enrollment — October 23, 2026

The missing confirmation was located in the recipient's Microsoft Defender quarantine: **Phish**, **Anti-spam policy**, received **9:42:47 p.m. Eastern**. Its RFC Message-ID matched Resend's accepted message. Receiver headers showed **SPF pass, both DKIM signatures pass, DMARC pass, compauth pass**, with `SCL:5`, `SFV:SPM`, `CAT:PHISH`, and `BCL:0`. The diagnosis is receiver phishing classification after successful authentication; the headers do not identify the particular content/reputation signal responsible. Exact recipient addresses, message IDs, and full headers remain in ignored owner-only local evidence.

The owner explicitly approved release of that specific legitimate email and reporting it as a false positive. Microsoft completed **Messages released to your inbox** with **Report message as having no threats** selected. Actual Outlook Inbox receipt at **9:54 p.m.** and the owner's receipt confirmation were observed. No sender allowlist, mailbox/tenant filtering exception, DNS change, TLS change, or authentication bypass was introduced.

Before enrollment, the verified but still-unenrolled actor explicitly requested one further code through **Confirm email for school enrollment → Send confirmation code**. The new **Your SupplyLoop email verification code** message appeared in the actual **Inbox at 10:01 p.m. Eastern**, without another release. The filtered mailbox results identified Inbox for the new message; refreshed Defender quarantine contained only the earlier released confirmation. This is a positive natural-delivery test for the existing-account OTP template in one Microsoft 365 mailbox. False-positive reporting can inform Microsoft's filtering, but one result does not guarantee all future Outlook deliveries or a fresh signup-confirmation message's placement.

| Apex acceptance check | Observed result |
| --- | --- |
| Wrong eight-digit email code | Friendly invalid/expired/used error; no signed-in school workspace |
| Actual confirmation code | Owner entered the code received in Outlook; signed-in enrollment screen showed no school workspace |
| Wrong private school code | Denied with the invalid/unavailable-code error; account remained unenrolled |
| First valid community enrollment | Private code enrolled the actor only as **School A student**, label **Apex Outlook demo student**, with Find/My pickups and no manager controls |
| Literal enrollment retry | A second tab retained its mounted join form; submitting a different label and wrong nonblank code after first enrollment returned the existing School A membership with the original label |
| Private record presentation | New student's My pickups showed zero active/collected records; item details exposed no manager storage, inspection, or audit fields; school selector offered only School A |
| Persistence and cleanup | Both tabs retained the original student membership after reload; sign-out cleared both private views and fresh reload stayed guest |
| Outlook account password re-login | Unverified at this enrollment checkpoint because the owner did not have the password handy; no password reset had yet been performed. Superseded by the successful personal reset/sign-in evidence in the password-recovery section above |
| Fixed-account regression | At 10:09 p.m. EDT, all six ordinary password logins, live actor checks, original school/role/active/label checks, and single-school reads passed; all six temporary sessions signed out locally |
| Current links and artifacts | All 70 tracked public files audited: both runtime email links use the apex; no old-subpage link in app/operator runtime code or published assets; old URLs are historical evidence or intentional 404 checks |

The fresh 10:01 email code was not consumed: the earlier successfully verified session was still within the enrollment proof window and was used to finish the join. The original Outlook password signup and the successful Gmail password-signup flow occurred before the domain move; no additional password account was created to manufacture a fresh fixture. The full five-scenario API suite was not repeated against an already-enrolled identity. Earlier ordinary-session authorization/concurrency and used-code evidence retain their original scope; this follow-up adds actual apex Outlook code entry, first school enrollment, and natural OTP delivery. No application, database, SMTP, or hosted-template implementation changed in this follow-up; the compiled Cloudflare deployment remains the same reviewed artifact.

Official documentation rechecked October 23, 2026, against unchanged Supabase JS **2.118.0** / hosted GoTrue **2.197.0**: [quarantine release/reporting](https://learn.microsoft.com/en-us/defender-office-365/quarantine-end-user#release-quarantined-email), [false-positive analysis](https://learn.microsoft.com/en-us/defender-office-365/quarantine-admin-manage-messages-files#release-quarantined-email), [Resend delivery meaning](https://resend.com/docs/knowledge-base/what-if-an-email-says-delivered-but-the-recipient-has-not-received-it), [deliverability Insights](https://resend.com/docs/dashboard/emails/deliverability-insights), and [Supabase code templates](https://supabase.com/docs/guides/auth/auth-email-templates). Microsoft reporting is feedback for analysis, not proof that a sender was permanently cleared. The earlier Gmail/signup evidence and deliberately untested browser network faults remain separately identified.

Independent QA completed the fixed-account regression at **02:09:08 UTC on October 24 (10:09 p.m. EDT October 23)** in **5.83 seconds**, using only ordinary authenticated SDK sessions and application reads. It made no business RPC calls, inventory writes, email requests, or privileged-key calls. The same check verified valid HTTPS, MIME types, and exact reviewed hashes for all three apex files; the old app remained a direct 404 with no app bundle, and the separate LUMEN root retained its original bytes and hash.

## Website domain cutover — October 23, 2026

Canonical address: **https://joinsupplyloop.app/**. The host is Cloudflare Pages **Direct Upload**, project `joinsupplyloop`, with Vite base `/`. Production deployment: `cfde0748-5eb8-4b35-bda8-ceed768763e2`. The source repository remains `leeohwang/supplyloop`. Deployment/configuration, focused new-origin browser acceptance, independent old-site retirement, and source publication/CI checks passed.

| Cutover check | Result and scope |
| --- | --- |
| Root-path candidate validation | Type checking, lint, all 42 unit/SDK tests, and production build passed |
| Compiled private-value scan | Passed for the new three-file `dist`; no private configuration values found |
| Cloudflare upload | Project created by manual Direct Upload of the reviewed root-`dist` ZIP, build reference `pznE3T`; no new API token or GitHub app authorization |
| Apex HTTPS and artifact comparison | Passed at 00:50:55 UTC on October 24 (October 23 EDT): valid HTTPS and all three public files matched the reviewed build manifest exactly |
| Application behavior correspondence | Published JavaScript/CSS hashes match the previously tested app exactly; no application behavior changed in this domain move |
| Cloudflare custom-domain state | UI showed **Active** and **SSL enabled** |
| Hosted Auth URLs | Site URL and sole exact redirect allowlist entry saved and reloaded as `https://joinsupplyloop.app/` |
| Hosted confirmation templates | Both saved and reopened; each preview showed one new-apex link, with original subjects, `{{ .Token }}`, eight-digit code, and one-hour wording retained |
| Mail DNS preservation | Independent QA verified 12/12 identical answers across two authoritative nameservers plus `1.1.1.1`, including the entire DKIM key, both sending CNAMEs, and scoped DMARC TXT |
| Separate root website preservation | Before and after old-site removal, LUMEN at `https://leeohwang.github.io/` returned HTTPS 200 with identical 2,453 bytes and SHA-256 `4ff96cf0e4926e8936bff44b402ed3d53e71df6b6b10153e8b3ab3f3e2f74787` |
| Fresh-origin browser acceptance | Passed: ordinary School A student/manager and School B student login, role screens, refresh, item details, reservation/cancellation, identifier-based school isolation, phone layout, cross-tab sign-out, and guest reload |
| Old GitHub Pages project retirement | Independent QA at 01:02:36 UTC October 24 confirmed exact old app URL and both old assets return 404 directly, with zero redirects; Pages API also returns 404, workflow 388769787 is `disabled_manually`, and apex/root checks still pass |
| Source publication and CI | Migration commit [`c0a729c8e20ef523f29afc1f676a0ceb6d83e306`](https://github.com/leeohwang/supplyloop/commit/c0a729c8e20ef523f29afc1f676a0ceb6d83e306) is published on `main`; [Verify SupplyLoop run 40048376495](https://github.com/leeohwang/supplyloop/actions/runs/40048376495) passed type checking, lint, unit tests, and build in a 19-second build job, with no deployment step |
| Source/build and private-value correspondence | Before publication, all 32 indexed build inputs matched the tested build snapshot; the 17-value scan of 70 indexed blobs and all three assets passed, with no credentials/private email exposure, ignored indexed files, unstaged changes, or stale asset subpaths |

The website move itself changed no credentials, accounts, memberships, application data, SMTP, or Resend sending-domain settings. The deliberate browser reservation/cancellation below added normal transaction/audit records and returned the object to stock; no migration or reset rewrote business history. Existing reviewers sign in again because local browser sessions belong to the old origin; their backend identities and history remain in the same Supabase project. The client retains `detectSessionInUrl: false` and entered-code verification. Updated template links and exact Auth settings do not themselves prove new mailbox delivery.

Future publication is manual: build and review a fresh ZIP containing only the root-level `dist` contents, then upload it to this Pages project's production environment. `.github/workflows/ci.yml`, **Verify SupplyLoop**, validates source and build only; it does not automatically deploy to Cloudflare. See [owner publishing instructions](judge-access.md#repository-owner-verification-and-manual-publication). Do not reintroduce the old GitHub deployment job, because a later deployment can republish an unpublished site. The public repository homepage also points to the apex.

The uploaded ZIP's SHA-256 was `dcf946dd187b914db17c921c92274933f4f34809593354de3af4bfe71b50d082`. Public artifact correspondence:

| File | SHA-256 |
| --- | --- |
| `index.html` | `d5a0ab2fb6f96f6565512fb5a97894f3e9c166c6193f0e380031ef8bb20ad0c1` |
| `assets/index-BhuDatqB.css` | `88284e5112fcb3a8a47f0daf356193c0fbd614f2692e59f5f8b89ef221ec4ae8` |
| `assets/index-C_72GE6N.js` | `2ec6f1af1b7a5a01c8a1146cd94cca1dcac9f9a758e408e861515dc8f0d85987` |

The follow-up evidence edits affect documentation only; they do not alter the 32 build inputs, hosted templates, Auth configuration, or deployed artifact. GitHub workflow `394728700` (`ci.yml`) is active. The former Pages workflow `388769787` was disabled before retirement; after its source path was removed from `main`, GitHub reported it as `deleted` at 01:11:30 UTC. That final post-publication check also confirmed apex file identity, old-site 404, and the unchanged LUMEN root. Source validation does not republish the retired site.

### Focused new-origin browser walkthrough

- School A student password sign-in opened Find and item details. The student reserved green garment `SL-220BADC18E78464AAA162DF11EF700D2` at **8:57 p.m. EDT on October 23**. Reload retained the active reservation in My pickups; cancellation at **8:58 p.m.** returned the object to available stock.
- School A manager password sign-in opened Manager desk directly with no student navigation or personal reservation controls. Live inventory and History showed two server events for the reservation/cancellation with the correct student actor. Manager reload retained the session.
- A fresh School B student login showed three School B item identifiers and excluded the School A test identifier. One School B garment had a similar green title; identifier comparison, rather than title exclusion, established isolation.
- At **390 × 844**, the student's document scroll width was **375 pixels**, with no horizontal overflow. The manager's 390-pixel phone viewport also had 375-pixel scroll width, only Manager desk navigation, and displayed History.
- Sign-out synchronized across the two tabs and cleared private views; fresh reload remained guest. Both tab consoles recorded **zero warnings and errors**. All test tabs ended signed out.

At the domain-cutover checkpoint, a full clothing/textbook handoff and new email/code-entry journey had not been repeated at the apex. The later Outlook section above adds actual new-origin confirmation, school enrollment, natural delivery, and receiver authentication evidence; the scoped `p=none` DMARC policy remains nonenforcing. The controlled Gmail signup/fresh-code, completed full-category walkthrough, and twenty ordinary hosted API scenarios below retain their original scope and remain applicable to the unchanged backend and byte-identical app JavaScript/CSS. Deliberate browser network faults and behavior on every physical mobile device remain unverified.

Official guidance checked **October 23, 2026**, for the unchanged installed React 19.3.1, TypeScript 6.0.2, Vite 8.3.4, Supabase JS 2.118.0, Node.js 22.20.0, and hosted PostgreSQL 17.11 / GoTrue 2.197.0: [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/), [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/), [Vite root-path deployment](https://vite.dev/guide/static-deploy.html), [Supabase Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [origin-specific browser storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), and [GitHub Pages unpublishing](https://docs.github.com/en/pages/getting-started-with-github-pages/unpublishing-a-github-pages-site). Full cutover documentation and compatibility notes are in [implementation notes](implementation-notes.md#website-domain-cutover--october-23-2026).

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

The October 18 GitHub Pages deployment and public browser/registration checks completed for the former flow. The later fixed-account/Gmail checks and scoped Outlook recovery/apex enrollment checks passed as recorded in their dated sections. One successful natural OTP delivery does not establish universal future Outlook placement. The backend remains on the approved Supabase Free plan, which can pause after seven days of low activity; the owner should verify availability before judging or explicitly select a paid plan. No upgrade or recurring automation was created. Optional unmet needs and shortage summaries are outside this core implementation. Real-school onboarding, privacy, retention, operational inspection, and pickup policy require human decisions before a real pilot.

## October 23 email-confirmation release — Gmail verified, Outlook unresolved

Address scope: this earlier release and public walkthrough were verified at the former GitHub Pages `/supplyloop/` address. The website-domain and Outlook recovery sections above record the later apex deployment, actual email-code enrollment, and scoped delivery acceptance. The unresolved Outlook status in this historical section is superseded by that follow-up.

The email upgrade was deployed at that public `/supplyloop/` address. Resend verified the owned sending domain, and the required Cloudflare records are installed. Custom SMTP was saved and its persistence checked: sender **SupplyLoop <noreply@auth.joinsupplyloop.app>**, Resend port **465**, with TLS enforced. Both the signup-confirmation and magic-link code templates were installed. Email/password signup and **Confirm Email** are enabled and their saved state was checked after reloading. Codes use eight digits, a one-hour lifetime, and a 60-second resend interval.

Supabase's new-password minimum is twelve; all six existing fixed passwords meet that length and were not changed. At this release checkpoint, the Site URL and sole allowed redirect were the exact published `/supplyloop/` address; the later domain cutover updated both as recorded above. Fixed judge accounts retain the ordinary password sign-in route with no email-confirmation wait. New School A enrollment requires recent email-OTP proof and the private community code. Earlier autoconfirmed accounts are not treated as proof of mailbox ownership.

The exact fourth migration, `20261023000100_email_confirmed_enrollment.sql`, was applied with SHA-256 `6acce7917a7cdd8703cbdc72c042003537a2d47fe4c6eb82e9d9fcccc6021174`. All nine pre/post table row-count and digest comparisons matched. Catalog checks passed for three reviewed functions, six RLS-enabled public tables, and eight public RPCs. This confirms the reviewed schema/configuration and preserved existing data; it does not prove delivery to a mailbox.

| Release check | Result and scope |
| --- | --- |
| `npm run check` | Passed on the exact materialized candidate |
| `npm run lint` | Passed on that candidate |
| `npm test` | 42 passed: 17 error boundaries and 25 actual-SDK lifecycle cases; no failures/cancellations/skips |
| `npm run build` | Passed; approximately 513 kB main JavaScript chunk, 144 kB gzip; nonblocking Vite size advisory |
| Compiled private-value scan | Three built files, sixteen private configuration values checked, explicitly including the operator secret key, zero matches |
| Earlier staged public source scan | 70 indexed blobs compared with sixteen private configuration values; zero credentials or private emails found. Only the documented local session-file locator matched in two documentation/example paths |
| Final release private-value scan | 70 staged blobs and three frozen compiled assets compared with seventeen private values, including operator secret, twelve fixed-account credentials, community code, two inboxes, and session-file locator; zero credentials/private emails found. Only the expected locator matched in `.env.email-test.example` and `tests/EMAIL_CONFIRMATION.md` |
| Core hosted API baseline | 15 passed with ordinary authenticated sessions before email cutover |
| Core hosted API after migration | 15 passed in 17.61 seconds with ordinary authenticated sessions; no failures/cancellations/skips |
| Isolated PostgreSQL 17.11 enrollment checks | Passed independently by implementation and QA, including strict recent OTP claims, helper permissions, preserved memberships, and concurrent enrollment |
| Pages CI and deployment | [Run 40039871848](https://github.com/leeohwang/supplyloop/actions/runs/40039871848) passed checks, 42 units, and build for `ec1ca9a4d0db97269df3a319eaf1bb2872c6a416` |
| Published artifact comparison | All three live HTML/JavaScript/CSS files were byte-identical to the tested build |
| Updated enrollment suite | Five recent-OTP scenarios passed in 8.53 seconds; no failures/cancellations/skips; combined with the core suite, 20 hosted scenarios passed |

The source-level late-verification issue was reproduced with the actual pinned Supabase SDK and fake transport. The fix coordinates complete explicit SDK actions across tabs, guards stale headers/body responses, and accepts the authoritative session only after settlement. Tests cover persistence windows, signup returning no session, queued timeouts and recovery, ordinary refresh, unsupported primitives, independent Auth transport deadlines, and local-only logout recovery. A disposable prior-settlement-policy control failed the targeted queued-timeout test. These tests send no real email and use no real credential or backend request; they do not establish real inbox delivery or browser network injection.

The rebuilt static preview was tested against the real hosted backend. School A student sign-in opened Find/My pickups; School A manager sign-in opened only Manager desk, and manager login survived refresh. A second tab shared the authorized session and sign-out cleared private views across tabs. A fresh School B student sign-in showed School B, student navigation, its catalog and personal pickups, and no old School A account context or manager navigation. The phone layout measured a 375-pixel document/content width at a 390 × 844 viewport, with no horizontal document overflow. The confirmation-recovery panel opened and focused its heading; code input uses eight digits and one-time-code autocomplete, and registration alone enforces the twelve-character client minimum. No new account or email was requested during these preview checks. Test logins were signed out and temporary browser pages were closed afterward.

### Actual confirmation and enrollment

A controlled Gmail signup received its code, and the owner entered it in the actual public app. A fresh existing-actor OTP explicitly requested by the public interface also arrived. Using ordinary Auth requests, a mutated code was rejected, the correct code was accepted once, and reuse was rejected. Submitting the used code through the public form produced a friendly rejection. This is real mailbox/code evidence for the controlled Gmail path; it is not inferred from provider logs.

The five hosted registration scenarios then passed with the recent ordinary OTP session: no school access before enrollment; bad community code and blank label denied without partial enrollment; all six fixed accounts preserved; editable metadata unable to choose role/school; concurrent enrollment creating one membership with an idempotent label; and the registered student's reservation and manager-confirmed pickup with role denials. Temporary private code/session files were removed after acceptance; fictional accounts and business history were retained.

### Current public student/manager walkthrough

- The manager saved an incomplete clothing draft; premature publication was safely denied. Editing, inspection, and publication succeeded. A physical textbook was also received, inspected, and published.
- Actual catalog controls excluded a wrong garment size and wrong textbook ISBN/edition. The student reserved both correct objects; both reservations survived reload. Garment cancellation released stock, and re-reservation succeeded.
- The manager collected both objects. At the walkthrough's baseline the counts were 46 available, 24 active pickups, and 10 completed; afterward they were 46, 24, and 12. Each collected object had exactly one completed event. These are dated operational snapshots, not a maintained statistics table or a claim about inspected physical stock.
- The student's final My pickups showed both objects as Completed with the 8:04 p.m. collection time, only Item details, and no Cancel controls. Reload preserved that history. Completed item details offered neither Reserve nor private storage details. Escape restored the exact Item details opener.
- The manager's terminal Inventory entries both showed Collected and had no action buttons.
- A fresh School B member sign-in showed only School B, its three garments, nine active pickups and zero collected, with no School A test titles or manager navigation. These are that account's snapshot counts.
- An existing peer public tab synchronized from School A to School B. Signing out in one tab removed the school selector, private navigation, and new test titles in both tabs; reload stayed signed out.
- At 390 × 844 viewport dimensions, document width and scroll width were both 375 pixels. Screenshots were retained as walkthrough evidence; this does not establish every physical mobile browser.
- The final public-tab console recorded zero warnings or errors. Both tabs were signed out, the peer tab was closed, and the phone viewport override was reset, leaving the public guest screen.

The fixed-account demonstration and controlled Gmail recording flow were verified through completed history, school isolation, and sign-out. A separate Outlook attempt was unresolved at this checkpoint: the recipient reported no message and found none by search. Resend reported Delivered, and Microsoft's server returned a 250 queued acknowledgement at 7:35 p.m. EDT on October 23. Those records prove transport acceptance, not recipient-visible inbox delivery; the later Outlook follow-up above adds receiver-side quarantine, recovery, and natural OTP Inbox evidence. No private inbox address, code, or message identifier is included here.

A DNS follow-up installed exactly one TXT record at `_dmarc.auth.joinsupplyloop.app` with `v=DMARC1; p=none;`, DNS-only with automatic TTL. Both authoritative nameservers and the independent `1.1.1.1` resolver returned the exact record with TTL 300 at 00:11 UTC. Existing DKIM and both sending CNAME records were unchanged; the parent-domain DMARC record remains absent and no parent record was changed. There is no `rua` reporting inbox. At that checkpoint no new mail had been sent after installation. The later Outlook follow-up supplies receiver-header DMARC-pass evidence, while the baseline remains nonenforcing and does not itself resolve phishing classification. [Resend's DMARC guidance](https://resend.com/docs/dashboard/domains/dmarc) distinguishes `none` from enforcement. A [Microsoft 365 message trace](https://learn.microsoft.com/en-us/exchange/monitoring/trace-an-email-message/message-trace-modern-eac) remains useful if a future message is again missing.

Deliberate public-browser network-fault injection remains unperformed. The successful code checks do not separately prove expired-code or every rate-limit/retry case. Browser checks do not establish every physical device/network; ordinary access tokens retain their configured lifetime after sign-out, and a local-only recovery cannot prove server-side revocation.
