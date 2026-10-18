# SupplyLoop judge access

## Release status and address

SupplyLoop is live at **https://leeohwang.github.io/supplyloop/** from the approved public repository `leeohwang/supplyloop`. GitHub Pages build and deployment succeeded, HTTPS returned HTTP 200, and the public browser walkthrough passed on October 18, 2026. No GitHub login is required. The registration release is commit `d637ddc2ea5eef4b27c7e02a185d9f6f950b76ae`; its successful [deployment run](https://github.com/leeohwang/supplyloop/actions/runs/39166150609) includes type checking, lint, 16 unit tests, and production build.

The selected setup uses a repository named `supplyloop`, the `main` branch, and the Vite base `/supplyloop/`. Renaming the repository or adding a custom domain requires reviewing the base path before another release. Navigation stays within the page, so reviewers should enter through `/supplyloop/` rather than an invented nested route.

## Reviewer walkthrough

Request the existing student and manager login details privately from the organizer. Use accounts from the same fictional school for one complete handoff. Credentials are not included in this document or the public site. Reviewers may also create their own School A student account using the private demo code described below. No GitHub account is needed to open the published site.

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

The registration flow uses email and password, followed by a fictional display label and the private demo code supplied by the organizer. It grants only student access to School A; it offers no manager role or school selection. Existing fixed-role accounts remain available for the two-school walkthrough. The enrollment migration and private hash configuration are installed; the approved unconfirmed email signup is enabled. All 20 hosted API scenarios pass, and both desktop and phone-sized public registration/enrollment have been exercised successfully.

Use an email address you control and a unique password. Email confirmation is intentionally disabled for this demo, so registration has no email wait and does not verify ownership of the email address. The display label is visible to the school manager; use a fictional label and enter no real student information in inventory or pickup notes. Keep the enrollment code and passwords out of public source, screenshots, and chat.

Account creation alone must not expose any school workspace. If the code is rejected or a connection fails after account creation, sign in to the same account and finish enrollment; do not assume the account needs to be recreated. If the enrollment response is lost, check the account's current membership before retrying. Successful repeated enrollment must preserve the same School A student membership and label.

## Repository owner: GitHub settings

The owner has authorized publishing this repository. The following settings still need to be completed and verified during deployment.

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

The app uses password sign-in and does not process email login callbacks. The owner approved enabling email/password signup with email confirmation disabled for this fictional demo. Apply and verify the enrollment migration and private code before enabling the new flow. GitHub Pages configuration alone does not change Supabase authentication settings or grant school access.

## Verify before sharing

The selected backend is still on Supabase Free. Low activity over seven days can pause it; the owner should open the app and check sign-in, catalog, and a normal manager/student flow before judging, and resume the project in Supabase if necessary. A paid plan avoids automatic inactivity pausing, but no upgrade or recurring monitor has been created. [Supabase project-pausing documentation](https://supabase.com/docs/guides/platform/free-project-pausing).

- Open the actual published `/supplyloop/` URL in a fresh browser without a GitHub login. Verify that JavaScript and styles load from `/supplyloop/`, the sign-in page is usable, and the demo guide and fictional-data notice are visible.
- Complete the student/manager handoff above against the hosted database, including a refresh, sign-out, and School B login. Check desktop and phone layouts; a local development walkthrough does not verify the deployed address.
- Verify a newly created account has no school data before a valid private code, a wrong code grants no access, and a valid code creates only a School A student membership. Retry enrollment after an uncertain response, sign out and back in, and confirm existing manager/student accounts retain their original memberships. Use no privileged backend bypass for these checks.
- Confirm managers open Manager desk, students get Find/My pickups, and a failed sign-in shows a useful message. Verify a reservation contested by two student accounts has one winner if repeating the release concurrency check; coordinate this with the organizer because it changes shared stock.
- In a controlled browser session, test a disconnected or failed request and retry. Check that an uncertain write is resolved by refreshing authoritative records, with no false success or duplicate collection. Deliberate network-loss and delayed-response behavior has not yet been experimentally verified.
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
