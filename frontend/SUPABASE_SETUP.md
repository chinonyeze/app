# Phase 2 — Supabase authentication and private profiles

The frontend stays in `frontend/` on CRA/CRACO, React, Tailwind, and shadcn.
This guide supersedes the Phase 1 auth/preview instructions in DEPLOYMENT.md.
The historical Next.js migration documents are not implementation instructions
for this phase. No Phase 3, AI, media, payment, or backend migration is included.

## Implemented behavior

- `/signup`: email/password signup with matching passwords and email verification.
- `/login`: email/password login or Google OAuth.
- `/auth/callback`: Supabase verification/OAuth return, then dashboard/onboarding.
- `/forgot-password`: sends a recovery link with an account-neutral success message.
- `/reset-password`: accepts a recovered session and updates the password. Missing
  or expired sessions prompt the user to request another link. A signed-in user
  may also change their password here, subject to Supabase security settings.
- `/onboarding`: requires a session and collects all eight requested profile fields.
- `/dashboard`, `/practice`, `/programs`, `/progress`, `/my-story`: redirect logged-out
  users to `/login`; signed-in users with incomplete profiles go to onboarding.
- Logout works on desktop, mobile, and during onboarding. It signs out this device.
- My Story now edits the Supabase profile. Older application/CV fields remain
  visible but disabled and explicitly not saved in this phase.
- All preview-user bypass code is removed, including development.
- Sessions persist and refresh via the Supabase browser client. Database RLS, not
  client-side routing, is the authority for profile access.

`current_status` and `interview_season` are required free-text fields because no
fixed option lists were requested. Graduation year must be 1900–2100. All profile
text fields are capped at 200 characters. Email comes from the auth account and
is not user-editable through the profile form.

## 1. Supabase project and database

1. Create or choose the Supabase project intended for MatchPrep. Keep its database
   password and secret/service-role keys out of this repository and frontend.
2. Open **SQL Editor → New query**. Paste and run
   `supabase/migrations/202609260001_profiles.sql` from the repository root once.
   This is a transactional initial migration and intentionally fails if a profiles
   table already exists rather than overwriting it. If one exists, inspect its
   schema before adapting the migration.
3. It creates `public.profiles` with these fields:
   `id`, `first_name`, `last_name`, `email`, `medical_school`, `specialty`,
   `applicant_type`, `graduation_year`, `current_status`, `interview_season`,
   `created_at`, `updated_at`.
4. An auth trigger creates one row per new auth user. Existing auth users are
   backfilled. Auth email changes synchronize to profiles; account deletion
   cascades. Updates set `updated_at` in PostgreSQL.
5. RLS is enabled. Authenticated users can select/update only their own row.
   Column grants allow only the eight onboarding fields to be updated. Anonymous
   reads, browser insert/delete, and edits to ID/email/timestamps are denied.
6. Run `supabase/tests/profiles_rls.sql` in a new SQL Editor query, preferably in a
   staging project. It creates two temporary test identities without passwords,
   checks ownership and privileges, and rolls everything back. An assertion or
   SQL error indicates a failure; successful completion rolls back the fixtures.

## 2. Enable email authentication

In **Authentication → Sign In / Providers → Email** (the dashboard may label this
Providers), enable email/password signup and **Confirm email**. Set a minimum
password length of at least 8 characters. Keep new-user signups enabled.

Under **Authentication → Email → SMTP Settings**, configure a real SMTP provider
and its verified sender domain/address. Put SMTP credentials only in Supabase.
The built-in email service is restricted to project-team addresses and is not
suitable for public signup or recovery. See [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

Keep the default Confirm Signup and Reset Password email links using
`{{ .ConfirmationURL }}`. This browser-only implementation uses Supabase's
implicit flow; the SDK consumes the returned session from the URL. Do not replace
these templates with an unimplemented server-side token exchange or direct
`/dashboard` link. Verification returns to `/auth/callback`; recovery must return
to `/reset-password`.

## 3. Set allowed redirect URLs

In **Authentication → URL Configuration**:

- **Site URL**: your actual deployed origin, e.g. `https://YOUR-APP.vercel.app`.
- Add these exact **Redirect URLs**, replacing the hostname:
  - `https://YOUR-APP.vercel.app/auth/callback`
  - `https://YOUR-APP.vercel.app/reset-password`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/reset-password`
- If using a custom domain or a separate trusted Vercel preview URL, add its two
  exact paths too. Do not allow arbitrary Vercel sites with a broad wildcard.

The app computes redirect URLs from the current browser origin. Therefore each
origin used for testing must be allowed. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## 4. Configure Google OAuth

1. In Google Cloud / Google Auth Platform, create/select your project. Configure
   consent screen branding, audience, support email, and the `openid`, email,
   and profile scopes. For an external app in Testing, add your test Google users;
   publish the consent configuration when ready for public sign-in.
2. Create an OAuth client with application type **Web application**.
3. Add your app origin(s) under **Authorized JavaScript origins** (e.g. the actual
   Vercel/custom domain, and `http://localhost:3000` for local testing).
4. In Supabase **Authentication → Sign In / Providers → Google**, copy the shown
   callback URL. It normally looks like:
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`.
5. Add that exact Supabase URL to the Google client's **Authorized redirect URIs**.
   This is different from the app's `/auth/callback` URL.
6. Copy the Google Client ID and Client Secret into the Supabase Google provider
   settings, enable the provider, and save. Neither belongs in Vercel frontend
   environment variables or source code.
7. Test Continue with Google from `/login` and `/signup`. A new user should land
   on onboarding, then the private dashboard after saving.

Reference: [Supabase Google OAuth setup](https://supabase.com/docs/guides/auth/social-login/auth-google).

## 5. Vercel and local environment

From the Supabase project's **Connect** dialog / **Settings → API Keys**, obtain
the Project URL and **publishable** key. A legacy `anon` key also works in the
publishable-key variable. These are public browser configuration; privacy comes
from RLS. Never use `sb_secret_...`, `service_role`, database passwords, or Google
client secrets. See [Supabase API key guidance](https://supabase.com/docs/guides/api/api-keys).

In Vercel **Project → Settings → Environment Variables**, add:

| Variable | Value |
| --- | --- |
| `REACT_APP_SUPABASE_URL` | Your Supabase Project URL |
| `REACT_APP_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key, or legacy anon key |

Apply to Production and whichever trusted Preview environments you intend to
use. Redeploy after saving: CRA embeds these variables at build time. No backend
URL is needed; leave `REACT_APP_BACKEND_URL` unset. Supabase credentials have not
been invented or filled in automatically.

Keep Vercel settings: Root `frontend`, Create React App preset, Node `20.x`,
Install `npm install --legacy-peer-deps` (plain `npm install` now also works),
Build `npm run build`, Output `build`. The existing SPA rewrite handles every
new route, including direct email/OAuth returns.

Locally, copy `frontend/.env.example` to `frontend/.env.local`, fill in the same
public values, then restart `npm start`. Local env files are ignored by Git.

```sh
cd frontend
npm install
npm run build
CI=true npm test -- --watchAll=false --runInBand
```

The only new app dependency is `@supabase/supabase-js`, pinned to `2.89.0` for
Node 20 compatibility (the latest checked version requires Node 22). AJV fixes
and the existing lockfile are preserved. `.npmrc` records `legacy-peer-deps=true`
for the existing CRA/React peer mismatches; no broad dependency upgrade was made.

## Verification and deployment acceptance

Local verification: npm install succeeded on Node 20.20.2 / npm 10.8.2; production
build succeeded; auth/profile/route tests pass. The migration and RLS SQL tests
passed in an isolated PGlite PostgreSQL engine with a minimal Supabase auth schema
stub. They must still be applied and checked against your real Supabase project.
No live Supabase account, OAuth provider, SMTP delivery, or deployed browser flow
was tested without project configuration. npm audit reports 33 dependency issues
(12 low, 6 moderate, 15 high); no automatic or breaking audit fixes were applied.

Before opening signup to users:

1. Sign up with a real test email, verify the email, finish onboarding, and refresh
   `/dashboard`. Check the profile row and reload My Story after editing it.
2. Log out, open each protected URL directly, and confirm it goes to `/login`.
3. Try a wrong password, then valid email/password login.
4. Complete Google login with a new test user and an existing user.
5. Request recovery while signed out. Open the email link, set a new password,
   then log out and confirm the new password works. Check expired/reused links.
6. Use two separate browser profiles for users A/B. Each must only read/update its
   own profile. Run the SQL RLS test as well; do not rely only on hidden UI routes.
7. Check mobile sign-out and direct navigation/reload of all new routes.

The backend and all out-of-scope service code remain in place. Supabase sessions
are not connected to the old backend. Interview tools, AI, transcription, media
analysis, program/history persistence, Stripe, and subscriptions remain unavailable.
