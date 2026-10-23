# SupplyLoop judge access

## Release status and address

SupplyLoop is live at **https://leeohwang.github.io/supplyloop/** from the approved public repository `leeohwang/supplyloop`. No GitHub login is required. The October 23 email-confirmation release is deployed from commit `ec1ca9a4d0db97269df3a319eaf1bb2872c6a416`; [deployment run 40039871848](https://github.com/leeohwang/supplyloop/actions/runs/40039871848) passed type checking, lint, all 42 unit tests, and the production build. All three published HTML/JavaScript/CSS files matched the tested build byte for byte.

**Email configuration is active; actual-inbox acceptance is pending.** The saved Supabase configuration enables email/password signup and Confirm Email, uses Resend SMTP on port 465 with TLS enforced, and sends as **SupplyLoop <noreply@auth.joinsupplyloop.app>**. Both code templates are installed; codes have eight digits, expire after one hour, and allow resend after 60 seconds. The fourth enrollment migration is applied, and all 15 core hosted API scenarios passed afterward. Actual signup/code delivery, the five hosted OTP registration scenarios, and the full public-origin handoff still need to be completed before recording. See [the verification record](verification.md#october-23-email-confirmation-release--activated-inbox-acceptance-pending).

The October 18 desktop and phone-viewport registration/handoff walkthroughs remain historical evidence for the former autoconfirmed flow. They do not verify the new email journey or prove ownership of any legacy account's mailbox.

The selected setup uses a repository named `supplyloop`, the `main` branch, and the Vite base `/supplyloop/`. Renaming the repository or adding a custom domain requires reviewing the base path before another release. Navigation stays within the page, so reviewers should enter through `/supplyloop/` rather than an invented nested route.

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

The current journey is **email and password → actual emailed confirmation code → fictional display label and private community code**. Email confirmation alone grants no school access. Enrollment grants only student access to School A; it offers no manager role or school selection. Existing fixed-role accounts remain available for the two-school walkthrough without an email wait. The reviewed email-enrollment migration and private hash configuration are installed. The new actual-inbox journey and five hosted OTP registration scenarios remain pending acceptance; the passing October 18 registration results used the former autoconfirmed flow.

1. Use an email address you control and a unique password of at least twelve characters. Create the account, then keep the confirmation panel open.
2. Enter the eight-digit code actually delivered by SupplyLoop. It expires after one hour; request another code explicitly if needed after the 60-second resend interval. Do not share the code or password in screenshots, source, or chat.
3. After confirmation, enter a fictional display label and the private School A community code supplied by the organizer. The label is visible to the school manager. Enter no real student information in inventory or pickup notes, and keep the community code private.

Account creation and email confirmation must not expose a school workspace before valid enrollment. If confirmation is unfinished, return to the same account and complete the email-code step rather than create another account. A legacy autoconfirmed account without a school membership must also obtain recent email-OTP proof before joining; its earlier account status does not prove mailbox ownership. If a community code is rejected or a connection fails after confirmation, sign in to the same account and finish enrollment. If the enrollment response is lost, check the current membership before retrying. Successful repeated enrollment must preserve the same School A student membership and label.

## Repository owner: GitHub settings

The owner authorized publication, and these settings were configured for the successful October 18 deployment. Preserve them during subsequent releases; this list also documents how to reproduce the setup.

1. Use the approved public GitHub repository `leeohwang/supplyloop`, with `main` as the deployment branch. Review the files before the first push: ignored local environment files, passwords, session tokens, the enrollment code, and server credentials must stay outside Git.
2. In **Settings → Actions → General**, enable GitHub Actions and allow the official `actions/*` actions used by `.github/workflows/pages.yml`, including their pinned commits. Organization policy may also control this setting. The workflow declares its own token permissions; it does not need a personal access token.
3. In **Settings → Secrets and variables → Actions → Variables**, add two **repository variables**:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | The existing demo project's HTTPS Supabase URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | That project's `sb_publishable_…` browser key |

   Both values are public browser configuration and become part of the compiled site. Never put a Supabase secret/service-role key, operator configuration, test password, or authenticated session token in these variables. Missing or malformed configuration fails the workflow before building.
4. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. Do not select deployment from the repository root or `docs` directory. The workflow uploads only `dist`, which contains the compiled site.
5. In **Settings → Environments → github-pages**, restrict deployment branches to **Selected branches and tags**, adding the branch `main`. Any configured required-reviewer protection must be satisfied before deployment. This environment receives only the deployment job, which requests `pages: write` and `id-token: write`; the build has read permissions.
6. Once publication is authorized, push the reviewed source to `main`, or run **Actions → Deploy SupplyLoop to GitHub Pages → Run workflow** with `main` selected. The workflow installs locked dependencies with Node.js 22.20.0, checks types, lints, runs unit tests, builds, uploads `dist`, then deploys the artifact. A failed check prevents deployment. It does not provision accounts, reset inventory, or run API tests against the shared database.
7. Wait for the deployment job to succeed, then use its environment URL. Editing repository variables requires a new workflow run because Vite embeds them at build time.

The app uses password sign-in and confirmation codes entered in the app. Supabase signup, Confirm Email, SMTP, templates, and the reviewed fourth enrollment migration are now active. SMTP credentials belong only in the private Supabase configuration, never GitHub browser variables or source. GitHub Pages configuration alone does not change Supabase authentication settings or grant school access.

## Verify before sharing

The selected backend is still on Supabase Free. Low activity over seven days can pause it; the owner should open the app and check sign-in, catalog, and a normal manager/student flow before judging, and resume the project in Supabase if necessary. A paid plan avoids automatic inactivity pausing, but no upgrade or recurring monitor has been created. [Supabase project-pausing documentation](https://supabase.com/docs/guides/platform/free-project-pausing).

- Open the actual published `/supplyloop/` URL in a fresh browser without a GitHub login. Verify that JavaScript and styles load from `/supplyloop/`, the sign-in page is usable, and the demo guide and fictional-data notice are visible.
- Complete the student/manager handoff above against the hosted database, including a refresh, sign-out, and School B login. Check desktop and phone layouts; a local development walkthrough does not verify the deployed address.
- Complete actual signup and code delivery to a controlled inbox, code entry, and explicit resend before calling the email journey verified. Run the five hosted OTP registration scenarios with that ordinary verified session. Confirm no school data is exposed before valid private-code enrollment, a wrong community code grants no access, and a valid code creates only a School A student membership. Retry enrollment after an uncertain response, sign out and back in, and confirm existing manager/student accounts retain their original memberships. Use no privileged backend bypass for these checks.
- Confirm managers open Manager desk, students get Find/My pickups, and a failed sign-in shows a useful message. Verify a reservation contested by two student accounts has one winner if repeating the release concurrency check; coordinate this with the organizer because it changes shared stock.
- In a controlled browser session, test a disconnected or failed request and retry. Check that an uncertain write is resolved by refreshing authoritative records, with no false success or duplicate collection. The 25 lifecycle tests use the actual pinned SDK with fake transport, storage, and locks, including delayed responses and account changes; they do not replace deliberate browser network-fault tests. Phone viewport checks do not establish behavior on every physical device or network.
- Keep the private credential handoff and recovery contact available for the review period. If the demo cannot be reached or stock has been exhausted, contact the organizer instead of sharing credentials publicly or restoring the database independently.

## Documentation and action pins

Official guidance and action release metadata checked **October 18, 2026**, for the installed Vite 8.3.4 project and GitHub-hosted Actions runners. Application dependencies were not upgraded. Actions use their own Node.js 24 runtime; `setup-node` selects Node.js 22.20.0 for the application checks and build.

- [Vite static deployment and project base paths](https://vite.dev/guide/static-deploy.html)
- [Vite environment variables and build-time exposure](https://vite.dev/guide/env-and-mode.html)
- [GitHub Pages custom workflows, artifacts, permissions, and environments](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Actions repository variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables)
- [GitHub Actions security and immutable action pins](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub Node.js builds and locked dependency installation](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
- [Supabase email/password signup](https://supabase.com/docs/reference/javascript/auth-signup) and [email confirmation configuration](https://supabase.com/docs/guides/auth/passwords), rechecked for the approved registration extension

Each latest stable release below was resolved through its official repository's GitHub API tag reference; the workflow uses the exact commit, not a moving version tag. The pinned action definitions were also read to confirm inputs and runtime compatibility.

| Official action release | Commit |
| --- | --- |
| [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| [configure-pages v6.0.0](https://github.com/actions/configure-pages/releases/tag/v6.0.0) | `45bfe0192ca1faeb007ade9deae92b16b8254a0d` |
| [upload-pages-artifact v5.0.0](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0) | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| [deploy-pages v5.0.1](https://github.com/actions/deploy-pages/releases/tag/v5.0.1) | `368f82528645a54fb793d4d04e342629a3f51346` |
