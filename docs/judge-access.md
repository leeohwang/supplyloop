# SupplyLoop judge access

## Release status and address

SupplyLoop is live at **https://joinsupplyloop.app/**, served from Cloudflare Pages Direct Upload project `joinsupplyloop`, production deployment `cfde0748-5eb8-4b35-bda8-ceed768763e2`. The approved public source repository remains `leeohwang/supplyloop`. Valid HTTPS and all three published files match the tested root-path build. Student and manager sign-in, a reservation/cancellation with server history, refresh persistence, School B separation, shared-profile sign-out, and desktop/phone layouts passed on the new origin. See [the current cutover evidence](verification.md#website-domain-cutover--october-23-2026) for exact scope and source/CI status. No GitHub login is required to use the app.

The previous October 23 email-confirmation release at `https://leeohwang.github.io/supplyloop/` is **historical release evidence**, from commit `ec1ca9a4d0db97269df3a319eaf1bb2872c6a416`. Its [deployment run 40039871848](https://github.com/leeohwang/supplyloop/actions/runs/40039871848) passed type checking, lint, all 42 unit tests, and the production build. The apex has its own artifact and browser checks above. The old project Pages site and both old assets now return 404 without redirects, its deployment workflow was disabled and removed, and the separate `https://leeohwang.github.io/` LUMEN root website remains byte-identical. The source repository is retained.

**The fixed-account demonstration and controlled Gmail recording flow passed at the previous address on October 23.** Actual Gmail signup/code entry, an explicit fresh-code request, the five recent-OTP enrollment scenarios, and the complete public clothing/textbook handoff passed. Together with the 15 core checks, 20 hosted API scenarios passed. The backend and compiled JavaScript/CSS are unchanged by the website move; those full scenarios were not repeated at the apex. The saved configuration uses Resend SMTP on port 465 with TLS enforced and sender **SupplyLoop <noreply@auth.joinsupplyloop.app>**. Both code templates now link to the apex and were saved and reopened in Supabase; codes retain eight digits, a one-hour lifetime, and a 60-second resend interval. The fourth migration remains applied. See [the verification record](verification.md#october-23-email-confirmation-release--gmail-verified-outlook-unresolved).

**Outlook recovery and new-domain enrollment passed on October 23.** Microsoft Defender showed the fresh confirmation in phishing quarantine even though SPF, DKIM, DMARC, and composite authentication passed. After the owner approved release and reporting the false positive, the message reached Inbox and its real code verified at the apex. A subsequent code email reached Inbox automatically at 10:01 p.m. Eastern, without a second release, sender allowlist, or filtering-policy change. Wrong school codes were denied; the valid private code granted School A student access, with original membership/label preserved on an actual second-tab enrollment retry. Refresh and cross-tab sign-out passed. See [the scoped acceptance record](verification.md#outlook-recovery-and-apex-enrollment--october-23-2026). One controlled mailbox does not establish every future Outlook delivery. If quarantine recurs, review the specific legitimate message in Microsoft Defender and use a [message trace](https://learn.microsoft.com/en-us/exchange/monitoring/trace-an-email-message/message-trace-modern-eac) with school IT as needed; do not disable filtering. The six fixed accounts require no email wait. Deliberate browser network faults and every physical mobile browser remain outside the completed checks.

The October 18 desktop and phone-viewport registration/handoff walkthroughs remain historical evidence for the former autoconfirmed flow. They do not verify the new email journey or prove ownership of any legacy account's mailbox.

The selected setup keeps the `supplyloop` repository and `main` branch, with Vite base `/` for the new domain. GitHub Actions verifies the source and build; publication is a separate manual Cloudflare upload. Navigation stays within the page, so reviewers should enter through `https://joinsupplyloop.app/` rather than `/supplyloop/` or an invented nested route. Browser sessions do not transfer between origins: existing reviewers sign in again on the new domain with their same private credentials. Accounts, roles, memberships, reservations, and history remain in the existing Supabase project.

## Reviewer walkthrough

Request the existing student and manager login details privately from the organizer. The six fixed accounts retain password sign-in with no email-confirmation wait. Use accounts from the same fictional school for one complete handoff. Credentials are not included in this document or the public site. Reviewers may also create their own School A student account through email confirmation and the private community code described below. No GitHub account is needed to open the published site.

The organizer's local `JUDGE-ACCESS.private.local` file contains the private logins, enrollment code, and a short walkthrough. Keep that file outside the public repository and share it only through the approved private submission channel.

1. Open the site in a fresh browser or private window. Check the persistent **Fictional demo data** notice, then expand **Demo guide: try both roles** on the sign-in page.
2. Sign in as a manager. **Manager desk** receives clothing and physical textbooks, saves incomplete drafts, and publishes complete items after inspection. Give a new demo item an easily recognized label and note its category details. A manager manages stock and collection; students reserve and receive items.
3. Sign out, then sign in as a student from the same school. In **Find**, match the garment type, variant, size, and minimum condition, or the textbook's exact ISBN and edition. Available stock appears; reserved stock is excluded. Reserve the item and check **My pickups**. Refresh to verify the reservation persists.
4. Sign out, then sign in as that school's manager. Locate the student's active reservation in the pickup queue and confirm collection. Check the updated stock and item history.
5. Return as the student and check the completed pickup. Repeat with the other category if desired. For a second-school check, sign out and use a supplied School B account: School A's items and operational history must remain inaccessible.

Separate browser profiles can keep a student and a manager signed in at the same time. Sign out before switching accounts in one profile. Sign-out ends the current browser session; another judge's independent session stays signed in.

## Shared accounts and inventory

The six existing accounts and fictional database are shared. Reviewers using the same student account see that account's reservations and history; they do not receive separate private workspaces. A separately registered student account has its own reservations, while its inventory and pickup operations remain shared with School A. Another reviewer may reserve the same item first, and a manager's confirmation affects the common pickup queue. Choose another available object or ask the organizer to prepare more fictional stock if needed.

There is no public reset button. The organizer must coordinate any restoration between review sessions, retain the versioned setup instructions, and avoid resetting while reviewers are active. Only fictional information should be entered. School staff would remain responsible for physical inspection and inventory in a real deployment.

## Registering a student account

The current journey is **email and password → actual emailed confirmation code → fictional display label and private community code**. Email confirmation alone grants no school access. Enrollment grants only student access to School A; it offers no manager role or school selection. Existing fixed-role accounts remain available for the two-school walkthrough without an email wait. Actual Gmail password signup/code entry and all five recent-OTP registration scenarios passed at the previous address on October 23. The subsequent apex Outlook check resumed an existing unconfirmed account and verified actual receipt, code entry, denied wrong school code, first valid student enrollment, retry stability, refresh, and sign-out. A brand-new password signup was not repeated at the apex. The changed/reused-code checks retain their prior scope; the apex wrong-code check also denied access. The October 18 registration results used the former autoconfirmed flow.

1. Use an email address you control and a unique password of at least twelve characters. Create the account, then keep the confirmation panel open.
2. Enter the eight-digit code actually delivered by SupplyLoop. It expires after one hour; request another code explicitly if needed after the 60-second resend interval. Do not share the code or password in screenshots, source, or chat.
3. After confirmation, enter a fictional display label and the private School A community code supplied by the organizer. The label is visible to the school manager. Enter no real student information in inventory or pickup notes, and keep the community code private.

Account creation and email confirmation must not expose a school workspace before valid enrollment. If confirmation is unfinished, return to the same account and complete the email-code step rather than create another account. A legacy autoconfirmed account without a school membership must also obtain recent email-OTP proof before joining; its earlier account status does not prove mailbox ownership. If a community code is rejected or a connection fails after confirmation, sign in to the same account and finish enrollment. If the enrollment response is lost, check the current membership before retrying. Successful repeated enrollment must preserve the same School A student membership and label.

## Repository owner: verification and manual publication

The selected release process uses GitHub for source and build verification, then Cloudflare Pages Direct Upload for the compiled site. It requires no Cloudflare API token, new GitHub app authorization, or deployment secret. The existing `.github/workflows/ci.yml` is named **Verify SupplyLoop** and has only repository-content read permission; it checks and builds without publishing to either host.

1. Use the approved public repository `leeohwang/supplyloop` and reviewed source on `main`. Keep ignored local environment files, passwords, session tokens, the enrollment code, and server credentials outside Git and uploaded archives.
2. In **Settings → Actions → General**, allow the official pinned `actions/checkout` and `actions/setup-node` actions used by the verification workflow. Organization policy may also control this setting. No personal access token is required.
3. In **Settings → Secrets and variables → Actions → Variables**, add two **repository variables**:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | The existing demo project's HTTPS Supabase URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | That project's `sb_publishable_…` browser key |

   Both values are public browser configuration and become part of the compiled site. Never put a Supabase secret/service-role key, operator configuration, test password, or authenticated session token in these variables. Missing or malformed configuration fails the workflow before building.
4. Push the reviewed source to `main`, or run **Actions → Verify SupplyLoop → Run workflow** with `main` selected. Wait for type checking, lint, unit tests, and the production build to pass. This workflow does not provision accounts, reset inventory, or run API tests against the shared database.
5. Build the same reviewed source locally with Node.js 22.20.0 and the existing public browser configuration in ignored `.env.local`. Run `npm ci`, `npm run check`, `npm run lint`, `npm test`, and `npm run build`. Confirm Vite base `/`; changing a `VITE_` value requires rebuilding because Vite embeds it in the assets. Check the compiled output for private values before upload. Do not include source, `.env` files, or operator/test fixtures.
6. Make a fresh ZIP containing the **contents** of `dist`, with `index.html` and `assets/` at the archive root. Remove any earlier generated `supplyloop-site.zip` before packaging, so updating an existing archive cannot retain obsolete files. From the repository root, `cd dist` and run `zip -r ../supplyloop-site.zip .`, then return to the repository root. Inspect the archive entries before uploading and keep the ZIP outside Git. A wrapper `dist/` directory inside the ZIP would put the entry point at the wrong path.
7. In Cloudflare **Workers & Pages**, open the Direct Upload project `joinsupplyloop` and select **Create a new deployment → Production**. Upload the reviewed ZIP and deploy it. For an initial project, choose the Pages drag-and-drop option, enter `joinsupplyloop`, and upload the same compiled ZIP. Record the deployment identifier and the exact source/build used. A passing GitHub verification run alone does not upload or publish this build. Direct Upload projects can use later manual uploads, but switching to Cloudflare Git integration requires a new project.
8. In the Pages project's **Custom domains**, associate `joinsupplyloop.app` using the existing Cloudflare zone in the same account; let the setup create the apex DNS record. Wait for the custom domain and HTTPS certificate to become active, then complete the checks below. Preserve the separate `auth.joinsupplyloop.app` Resend records and scoped DMARC record.
9. Only after new-domain acceptance, disable/unpublish the GitHub Pages site for **`leeohwang/supplyloop`**. Keep the build-only workflow and source repository; do not change the separate `leeohwang.github.io` root website. Verify that the former project URL returns 404 rather than the app or a redirect. Do not restore a GitHub Pages deploy job: a later successful deployment could republish an unpublished site.

## Authentication configuration for the new address

Keep the existing Supabase project, publishable browser key, accounts, memberships, and database history. **Authentication → URL Configuration** was saved and reloaded with **Site URL** `https://joinsupplyloop.app/` and that same sole exact redirect allowlist entry. The former production URL was removed. Preserve those exact production settings; do not add broad preview-domain wildcards.

Keep signup and Confirm Email on, the reviewed fourth migration applied, Resend SMTP and Enforced TLS configured, and both templates' code-based flow. In both hosted templates, update the **Open SupplyLoop** link to `https://joinsupplyloop.app/`, matching `supabase/email-templates/confirm-signup.html` and `magic-link.html`. Keep `{{ .Token }}` and the eight-digit/one-hour wording; do not replace the code with an automatic sign-in link. The client verifies entered codes directly and retains `detectSessionInUrl: false`.

SMTP credentials belong only in private Supabase configuration, never browser variables, source, or uploaded assets. Changing the website URL does not itself grant school access or prove new-domain email delivery. A user continuing unfinished confirmation on the new origin may need to enter their email again; the old browser's pending-email hint and session do not transfer. Use the same account rather than creating a replacement.

## Verify before sharing

The selected backend is still on Supabase Free. Low activity over seven days can pause it; the owner should open the app and check sign-in, catalog, and a normal manager/student flow before judging, and resume the project in Supabase if necessary. A paid plan avoids automatic inactivity pausing, but no upgrade or recurring monitor has been created. [Supabase project-pausing documentation](https://supabase.com/docs/guides/platform/free-project-pausing).

- Open `https://joinsupplyloop.app/` in a fresh browser without a GitHub login. Valid HTTPS, successful JavaScript/CSS responses from `/assets/`, the usable sign-in page, demo guide, fictional-data notice, and the scoped fresh-origin checks above passed at cutover. Repeat the intended recording path before sharing because the backend and stock are shared.
- Complete the student/manager handoff above against the hosted database, including a refresh, sign-out, and School B login. Check desktop and phone layouts; a local development walkthrough does not verify the deployed address.
- Preserve the completed controlled Gmail signup, explicit fresh-code, and five-scenario OTP acceptance evidence. Before recording, confirm that the intended recipient can actually see and submit a new code; a provider delivery event alone is insufficient. No school data may be exposed before valid private-code enrollment; a wrong community code must grant no access, and a valid code must create only a School A student membership. Retries must preserve membership/label and fixed accounts must retain their roles. Use no privileged backend bypass for these checks, and do not rerun the retained registration fixture as though it were still unenrolled.
- Confirm managers open Manager desk, students get Find/My pickups, and a failed sign-in shows a useful message. Verify a reservation contested by two student accounts has one winner if repeating the release concurrency check; coordinate this with the organizer because it changes shared stock.
- In a controlled browser session, test a disconnected or failed request and retry. Check that an uncertain write is resolved by refreshing authoritative records, with no false success or duplicate collection. The 25 lifecycle tests use the actual pinned SDK with fake transport, storage, and locks, including delayed responses and account changes; they do not replace deliberate browser network-fault tests. Phone viewport checks do not establish behavior on every physical device or network.
- Keep the private credential handoff and recovery contact available for the review period. If the demo cannot be reached or stock has been exhausted, contact the organizer instead of sharing credentials publicly or restoring the database independently.
- After acceptance and old-site retirement, verify `https://leeohwang.github.io/supplyloop/` returns 404 without redirecting, while `https://leeohwang.github.io/` still serves the existing root website. Record these outcomes before claiming the move complete.

## Documentation and action pins

Current hosting, root-path, authentication URL, and build-verification guidance was checked **October 23, 2026**, for Vite 8.3.4, Supabase JS 2.118.0, Cloudflare Pages Direct Upload, and GitHub-hosted Actions runners. Application dependencies were not upgraded. The two active action pins were resolved and their definitions checked on October 18; they remain unchanged. Actions use their own Node.js 24 runtime; `setup-node` selects Node.js 22.20.0 for the application checks and build.

- [Vite static deployment and project base paths](https://vite.dev/guide/static-deploy.html)
- [Vite environment variables and build-time exposure](https://vite.dev/guide/env-and-mode.html)
- [Cloudflare Pages Direct Upload and dashboard ZIP publishing](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Cloudflare Pages custom apex domains and HTTPS setup](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [GitHub Pages unpublishing and later workflow redeployment](https://docs.github.com/en/pages/getting-started-with-github-pages/unpublishing-a-github-pages-site)
- [GitHub Actions repository variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables)
- [GitHub Actions security and immutable action pins](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub Node.js builds and locked dependency installation](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
- [Supabase Site URL and redirect allowlist](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase code-based email templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [client session configuration](https://supabase.com/docs/reference/javascript/initializing)
- [Origin-specific browser session storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

Each active release below was resolved through its official repository's GitHub API tag reference on October 18; the verification workflow uses the exact commit, not a moving version tag. The former `configure-pages`, `upload-pages-artifact`, and `deploy-pages` actions belong only to historical deployment evidence and are no longer in the current workflow.

| Official action release | Commit |
| --- | --- |
| [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
