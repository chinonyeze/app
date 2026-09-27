> Phase 2 now uses Supabase authentication and profiles. Follow [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for current setup. The Phase 1 auth/preview instructions below are historical.

# Phase 1: CRA frontend on Vercel

This is the current Phase 1 deployment guide. MIGRATION_PLAN.md and
PHASE1_CLAUDE_CODE.md remain historical project documentation; their Next.js,
Supabase, backend replacement, and later-phase instructions are not part of this phase.

## Local use

Use Node 20 (`nvm use` in this directory if you use nvm).

```sh
cd frontend
npm install --legacy-peer-deps
npm start
```

Development has a simulated Pro user for inspecting the existing application UI.
A DEVELOPMENT/PREVIEW ONLY banner labels it. It is not authentication or a paid
subscription. All API requests are rejected locally in development so the fixture
cannot access a real backend. Logout clears the fixture until reload/refresh.
Existing pages may show empty/default values because no backend data is available.

```sh
npm run build
```

Production builds (including Vercel Preview deployments) never initialize the
preview user. Protected application routes redirect to the public landing page.
Sign-in/start buttons explain that authentication is unavailable. The old Emergent
OAuth callback is disconnected. No environment variables or credentials are
required. Leave REACT_APP_BACKEND_URL unset for this deployment. Never put secrets
in REACT_APP_* variables: CRA includes them in public browser assets.

## Vercel

Commit and push migration/cra-vercel before deploying. Keep main unchanged.

1. In Vercel select **Add New → Project**, import this Git repository, and use a
   separate project for this Phase 1 frontend if an existing project serves main.
2. Set **Root Directory** to `frontend` and **Framework Preset** to Create React App.
3. Set **Install Command** to `npm install --legacy-peer-deps`, **Build Command** to
   `npm run build`, **Output Directory** to `build`, and **Node.js Version** to `20.x`.
4. Ensure the deployment source is `migration/cra-vercel`, not main. In project
   Settings → Environments → Production, set the branch to `migration/cra-vercel`
   if this dedicated project should publish the branch as production. If import
   defaults to main, configure the project first, then create a deployment from
   `migration/cra-vercel` in Deployments. Do not merge just to deploy.
5. Add no environment variables for Phase 1, then deploy the migration branch.
6. Check `/`, refresh `/dashboard` (must return to `/`), click Sign in (availability
   notice), and visit `/payment/success` (unavailable, no activated subscription).

frontend/vercel.json supplies the build commands and SPA fallback for direct
React Router URLs. Node is also declared in package.json and .nvmrc.

References:
- https://vercel.com/docs/frameworks/frontend/create-react-app
- https://vercel.com/docs/builds/configure-a-build
- https://vercel.com/docs/project-configuration/vercel-json

## Not functional in Phase 1

- Real sign-in, signup, sessions, and authorization: no replacement auth provider.
- Profile saving, program persistence, question banks, history, progress: no deployed
  backend/database. UI fixtures/defaults are not saved user data.
- Mock interview AI, speech transcription/TTS, scoring, camera/video analysis:
  existing backend integrations and service credentials are not configured.
  Existing browser media controls may still request permission in local preview;
  this does not provide transcription or analysis.
- Stripe checkout, subscriptions, trials, and payment confirmation: no payment
  service configured. Marketing/pricing content is preserved, not a working offer.

## Dependencies and retained legacy files

AJV ^8.17.1 and ajv-keywords ^5.1.0 are preserved. The existing npm lockfile is
updated in place. No framework or broad dependency upgrades were performed.
The Emergent visual-edits package and CRACO integrations are removed; the old
webpack-dev-server 5 adapter is unnecessary with npm's resolved CRA server 4.
The Yarn packageManager declaration is removed; use npm. Historical Yarn-only
resolutions remain unchanged and are not npm overrides.

Emergent analytics and injected scripts are removed from public/index.html.
Unused frontend/plugins/health-check files and legacy test-ID references remain
but are not loaded. The backend (including emergentintegrations), .emergent, and
historical documents remain untouched. No deployment or Phase 2 work was done.

## Verification

Verified with Node v20.20.2 / npm 10.8.2:
- npm install --legacy-peer-deps: succeeded, removed the visual-edits package.
- npm run build: compiled successfully.
- CI=true npm run build: compiled successfully.
- npm ls ajv ajv-keywords webpack-dev-server: valid resolved tree.
- Production JavaScript excludes preview identity and Emergent runtime URLs.

Browser visual testing was unavailable in this environment. Verify the deployed
page using the checklist above before publishing a custom domain.
