# MatchPrep AI — Emergent Exit & Migration Plan

Source audited: `chinonyeze/app` @ `main` (audited 2026-09-27). No code has been changed.

---

## A. Existing architecture

**Layout**

```
/.emergent/        Emergent platform config + cron scripts (platform-only)
/backend/          FastAPI app — a single file, server.py (~780 lines)
/frontend/         Create React App (CRA via CRACO) + Tailwind + shadcn/ui
/memory/PRD.md     Emergent agent's product notes
/test_reports/     Emergent testing-agent output
/test_result.md    Emergent testing-agent protocol file
/design_guidelines.json  Emergent design-agent output
```

**Frontend**
- React 19, **Create React App** (`react-scripts 5`) wrapped in **CRACO**. Plain JavaScript (`.js`/`.jsx`), no TypeScript. `@/` alias → `src/`.
- Client-side routing with `react-router-dom` v7 (`BrowserRouter`). Everything renders in the browser; no SSR.
- Styling: Tailwind 3.4 + shadcn/ui (46 Radix-based components in `src/components/ui/`), `tailwindcss-animate`. Theme tokens are CSS variables in `src/index.css`. Fonts: Outfit (display), Inter (body), JetBrains Mono, all loaded from Google Fonts.
- Data: `axios` instance in `src/lib/api.js` pointing to `REACT_APP_BACKEND_URL/api`, `withCredentials: true` (cookie auth). `@tanstack/react-query` is installed and set up but most pages call the api helpers directly.
- Other libraries: `recharts` (progress radar), `sonner` (toasts), `lucide-react` (icons), `framer-motion`.
- Browser APIs: `getUserMedia` + `MediaRecorder` for voice/video mock interviews (Practice page).

**Landing page** (`frontend/src/pages/Landing.jsx`)
- One React component: sticky glass nav → hero (headline, 2 CTAs, mock interview preview card) → 6-card feature grid → pricing (`<PlansGrid>` from `components/Plans.jsx`) → footer.
- Built from shadcn `Button` and `Card`, Lucide icons, and Tailwind utility classes plus a few custom classes (`glass`, `hover-lift`, `fade-in-up`, `stagger`, `wave-bar`) defined in `index.css`.
- "Sign in" and "Start free" both redirect to `https://auth.emergentagent.com/?redirect=…`.
- Pricing buttons call the backend's Stripe checkout (or send the user to sign in first).

**Routes**

| Path | Page | Access |
|---|---|---|
| `/` | Landing | Public |
| `/#session_id=…` | AuthCallback (inline in `App.js`) | Emergent OAuth return |
| `/payment/success` | PaymentSuccess (polls status) | Public |
| `/payment/cancel` | PaymentCancel | Public |
| `/dashboard` | Dashboard | Protected (inside AppShell) |
| `/practice` | Practice — voice/video mock interview | Protected |
| `/programs` | Programs — list, "Know This Program", "Why Us" | Protected |
| `/progress` | Progress — radar, streak, history | Protected |
| `/my-story` | MyStory — applicant profile form | Protected |

`AppShell.jsx` holds the sidebar (desktop), pill tab bar (mobile), user badge, logout button and upgrade dialog.

**Backend**
- **FastAPI** + Uvicorn, one file (`backend/server.py`), every route under `/api`.
- **MongoDB** via Motor (async). Collections: `users`, `user_sessions`, `profiles`, `interview_sessions`, `question_bank`, `programs`, `streaks`, `payment_transactions`.
- **LLM**: Claude Sonnet 4.5 (chat + vision) through Emergent's `emergentintegrations` package and the Emergent "Universal Key".
- **Voice**: OpenAI `tts-1` and `whisper-1`, called with the Emergent key through `INTEGRATION_PROXY_URL`, with a direct-OpenAI fallback that won't work with an Emergent key.
- **Payments**: Stripe Checkout (subscription + one-time), status polling, webhook. Plans (lookup keys): `matchprep_essential_monthly`, `matchprep_pro_monthly` (7-day trial), `matchprep_season_pass_one_time`.

API endpoints: `auth/session`, `auth/me`, `auth/logout`, `profile` (GET/PUT), `interview/start|message|end/{id}|sessions`, `analyze/speech|sarr|frame`, `questions` + `questions/generate`, `programs` (GET/POST/DELETE) + `programs/know|why-us`, `progress/summary`, `tts`, `stt`, `payments/checkout|status/{id}`, `stripe/webhook`, `/` health check.

**Authentication (current)**
- Google sign-in only, **handled by Emergent**. The browser goes to `auth.emergentagent.com` and comes back to `/#session_id=…`. The frontend posts that ID to `/api/auth/session`. The backend exchanges it with `demobackend.emergentagent.com`, upserts a Mongo `users` row, stores the Emergent-issued `session_token` in `user_sessions` (7-day expiry) and sets it as an httpOnly cookie. A Bearer header also works as a fallback.
- No email/password, password reset, or email verification.
- Authorization is enforced by hand: every query filters on `user_id`. Nothing in the database enforces it.

**Database (current)**
- MongoDB exists, but only inside Emergent's container (`MONGO_URL`, `DB_NAME` come from an `.env` file that isn't in the repo). There are no schemas, migrations or seed data in the repo, and no data export.

---

## B. Reusable

- **All of the visual design**: `index.css` (tokens, fonts, custom classes), `tailwind.config.js`, `components.json`, and all shadcn `components/ui/*`. These are framework-agnostic, so they work unchanged in Next.js.
- **Page components** (`Landing`, `AppShell`, `Dashboard`, `Practice`, `Programs`, `Progress`, `MyStory`, `PaymentSuccess/Cancel`, `Plans`). Their JSX and Tailwind markup can move over as-is. Only routing imports (`react-router-dom` → `next/link`, `next/navigation`), the auth hook, and the data-layer calls need changing.
- **`lib/api.js` function signatures**. Keep the same function names and swap the implementations, so page code barely changes.
- **Business logic in `server.py`**, ported to TypeScript route handlers/server actions:
  - interviewer personalities and modes, and all prompt text
  - scoring, SARR, speech (WPM/filler) and frame-analysis prompts
  - `_extract_json`, streak logic, progress aggregation
  - Stripe checkout, trial logic and webhook handling (logic reusable; storage changes to Supabase)
- **Practice page media code** (MediaRecorder mime-type negotiation, already debugged per `test_reports/iteration_3.json`).
- **Data model**: the Mongo document shapes map directly onto Postgres tables (see E, Phase 2).

---

## C. To replace

| Current | Replace with |
|---|---|
| CRA + CRACO + react-router | Next.js (App Router) + TypeScript |
| FastAPI `server.py` | Next.js Route Handlers / Server Actions on Vercel |
| MongoDB (Motor) | Supabase Postgres with Row Level Security |
| Emergent Google Auth + custom session cookie | Supabase Auth (email/password, Google OAuth, verification, reset) via `@supabase/ssr` |
| `AuthContext` + `getMe` polling | Supabase session, read server-side in Next.js middleware/layouts |
| `emergentintegrations` + Emergent Universal Key | Official Anthropic SDK (`@anthropic-ai/sdk`) with your own `ANTHROPIC_API_KEY` |
| TTS/STT via Emergent proxy | Official OpenAI SDK with your own `OPENAI_API_KEY` (or another provider) |
| Frames/audio as base64 in request bodies only | Supabase Storage, private buckets, per-user folder policies (only if you want to keep recordings) |
| Stripe sandbox tied to Emergent | Your own Stripe account (Phase 6, later) |
| PostHog snippet using Emergent's project key | Remove, or use your own analytics key |
| `public/index.html` title/meta ("Emergent \| Fullstack App") | Next.js `metadata` with MatchPrep branding |
| Custom `/payment/status` polling that trusts any session_id | Webhook-driven subscription state in Supabase |

**Existing issues to fix during the port:**
- CORS allows **any origin with credentials** (`allow_origin_regex=".*"`).
- `/api/payments/status/{session_id}` needs no login and can change a user's plan.
- Pricing mismatch: PRD says $20/mo, the UI shows Essential $9.99 / Pro $19.99 / Season Pass $69, and the sidebar says "From $9.99".
- The Stripe `managed_payments` parameter is non-standard. Check it against your own Stripe account.
- Data access is protected only by app code. RLS will enforce it in the database.

---

## D. Emergent dependencies found

**Files/folders (platform-only, delete)**
- `.emergent/emergent.yml`: Emergent container image (`fastapi_react_mongo_shadcn_base_image_cloud_arm`)
- `.emergent/system_deps.txt`
- `.emergent/cron/dispatch_webhook.sh`, `watch_crons.sh`, `webhook_crond.sh`, `webhook-crons`: pod cron system calling `https://ea.int.apis.emergentagent.com`, with a hard-coded `JOB_ID`
- `test_result.md`, `test_reports/*`, `memory/PRD.md`, `design_guidelines.json`: Emergent agent artifacts (keep PRD content as product documentation if useful)
- `frontend/plugins/health-check/*`: Emergent preview health endpoints (only loaded when `ENABLE_HEALTH_CHECK=true`)
- `frontend/src/constants/testIds/*`: references an Emergent lint rule and a `home-emergent-link` ID

**Packages**
- Python: `emergentintegrations==0.2.0`
- npm (dev): `@emergentbase/visual-edits` from `https://assets.emergent.sh/npm/…tgz`, loaded in `craco.config.js`

**URLs / services**
- `https://auth.emergentagent.com/?redirect=…` (Landing.jsx): login
- `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data` (server.py): session exchange
- `https://assets.emergent.sh/scripts/emergent-main.js` (index.html): injected platform script
- `https://ap.emergent.sh` + PostHog key `phc_DbsPb39…` (index.html): analytics/session recording sent to **Emergent's** PostHog, with `recordCrossOriginIframes: true`
- `https://ea.int.apis.emergentagent.com` (cron)
- `INTEGRATION_PROXY_URL` → Emergent's OpenAI proxy (TTS/STT)

**Environment variables**
- Backend: `MONGO_URL`, `DB_NAME`, `EMERGENT_LLM_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `INTEGRATION_PROXY_URL`, `WEBHOOK_CRON_SECRET` (cron)
- Frontend: `REACT_APP_BACKEND_URL`, `ENABLE_HEALTH_CHECK`
- None of the `.env` files are in the repo, so their values stayed on Emergent.

**Branding leftovers**: `<title>Emergent | Fullstack App</title>`, meta description "A product of emergent.sh", `README.md` ("Here are your Instructions").

---

## What blocks running outside Emergent today

1. **Login cannot work.** Auth depends on Emergent's hosted OAuth and session-exchange endpoints.
2. **No AI features work.** `emergentintegrations` + `EMERGENT_LLM_KEY` are Emergent-only (the key was already hitting its budget cap in testing). TTS/STT depend on Emergent's proxy.
3. **No database.** MongoDB lived inside the Emergent pod. There is no connection string, schema or data export in the repo.
4. **No env files.** Every required secret is missing.
5. **The frontend build pulls from Emergent.** `@emergentbase/visual-edits` installs from `assets.emergent.sh`, and `index.html` loads `emergent-main.js`. If those URLs disappear, install/runtime breaks.
6. **Stripe keys and prices** are in an Emergent-provisioned sandbox, so they need to be recreated in your account.
7. **Deployment**: the backend is a long-running Python server built for Emergent's container. It doesn't fit Vercel as it is.

## Can the design be preserved?

**Yes.** All UI is Tailwind + shadcn/ui + Lucide in plain React components, with no Emergent code in the view layer. It ports into Next.js with only routing and data-fetching changes. The aim is pixel parity: same `index.css`, same Tailwind config, same components, same markup.

---

## E. Recommended migration plan

**Target stack:** Next.js 15 (App Router) · TypeScript · Tailwind 3.4 (stay on 3.x at first so the existing config works unchanged; 4.x later if wanted) · shadcn/ui · Supabase (Auth, Postgres + RLS, private Storage) · Vercel · Stripe (later) · Anthropic + OpenAI SDKs with your own keys.

### Phase 0 — Safety & inventory (no behavior change)
- Create branch `migration/nextjs-supabase`. Tag current `main` as `emergent-final`.
- Export any production data from Emergent's MongoDB if real users exist (ask Emergent support for a `mongodump`, or accept a fresh start).
- Get your own accounts/keys: Supabase project, Vercel project, Anthropic API key, OpenAI API key, Stripe account (test mode).

### Phase 1 — Scaffold Next.js and port the UI as-is
- `create-next-app` (TypeScript, Tailwind, App Router, `src/`), placed in the repo root or `/web`.
- Copy `index.css` → `app/globals.css`, `tailwind.config.js`, `components.json`, `components/ui/*`, `lib/utils`.
- Load fonts with `next/font/google` (Outfit, Inter, JetBrains Mono) in place of the CSS `@import`.
- Routes: `app/page.tsx` (Landing), `app/(app)/layout.tsx` (AppShell), `app/(app)/dashboard|practice|programs|progress|my-story/page.tsx`, `app/payment/success|cancel/page.tsx`.
- Swap `react-router` → `next/link` / `usePathname` / `useRouter`. Mark interactive pages `"use client"`.
- Convert files to `.tsx` gradually; `allowJs` lets them move over unchanged first.
- Drop CRACO, react-scripts, visual-edits, the health-check plugin, the Emergent script and PostHog.
- **Checkpoint:** side-by-side visual comparison with the Emergent build. It must match before continuing.

### Phase 2 — Supabase schema + RLS
Tables (all with `user_id uuid references auth.users` + `created_at`, RLS enabled, policy `user_id = auth.uid()` for select/insert/update/delete):
- `profiles` (1:1 with user; MyStory fields + `plan`, `trial_used`, `trial_ends_at`, `subscription_status`, `stripe_customer_id`; created by trigger on `auth.users` insert)
- `interview_sessions` (personality, mode, program_name, system_prompt, `messages jsonb`, `scores jsonb`, ended_at)
- `question_banks` (`questions jsonb`, generated_at)
- `programs` (name, specialty, city, notes, reasons text[])
- `streaks` (days, last_day)
- `payment_transactions` (written only by the server using the service role; users can read their own rows)
- Keep billing fields (`plan`, etc.) outside what users can update themselves: use a separate `subscriptions` table or column-level protection, so users can't give themselves Pro.
- Storage (optional): private bucket `recordings`, path `{user_id}/…`, policies restricted to the owner.
- Keep migrations in `supabase/migrations/` in the repo.

### Phase 3 — Authentication (Supabase)
- `@supabase/ssr` browser + server clients. `middleware.ts` refreshes the session and guards `/(app)` routes.
- Pages: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback` (OAuth + email-link code exchange), `/auth/confirm`.
- Email/password with required email verification. Google OAuth (Google Cloud client ID → Supabase provider). Logout. Password reset.
- Replace `AuthContext` with a small hook built on Supabase `onAuthStateChange`, keeping the same `{ user, loading, logout }` shape so AppShell stays unchanged.
- Style the auth pages with the existing tokens/components.

### Phase 4 — Port the backend into Next.js
- `app/api/*` route handlers (or server actions), one per existing endpoint, same paths so `lib/api.ts` changes little.
- Each handler: create a server Supabase client → `getUser()` → query under RLS. The service role is used only for the Stripe webhook.
- `lib/ai.ts`: Anthropic SDK (chat with real multi-turn `messages`, replacing the flattened prompt; vision with image blocks). Prompts copied verbatim.
- `lib/voice.ts`: OpenAI TTS/STT. Check Vercel function body limits for audio uploads (upload to Storage first if needed) and set `maxDuration` for long LLM calls.
- Validate input with `zod` (already a dependency).

### Phase 5 — Deploy
- Vercel project linked to the repo. Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, (later) `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`.
- Supabase Auth: set Site URL + redirect URLs for production and Vercel previews. Set up a custom SMTP sender (Resend/Postmark) for verification/reset emails.
- Custom domain. Verify camera/mic permissions work over HTTPS.

### Phase 6 — Stripe (later)
- Recreate products/prices with the same lookup keys. Checkout via a route handler. The webhook (`checkout.session.completed`, `customer.subscription.updated|deleted`) is the only thing that writes plan state. Add a Customer Portal for cancellations.
- Settle the pricing mismatch before launch.

### Phase 7 — Cleanup & cutover
- Delete `/backend`, `/frontend` (CRA), `.emergent/`, agent artifacts. Rewrite `README.md`.
- Tests: RLS tests (user A can't read user B's data), auth-flow smoke tests, one end-to-end mock interview.
- Merge to `main`, point the domain at Vercel, shut down Emergent.

---

## F. Repository strategy

**Recommendation: same repository, dedicated branch** (`migration/nextjs-supabase`), with `main` tagged `emergent-final` first.

- Keeps history and lets you diff the old and new implementations of each page.
- `main` stays a working reference until cutover. The migration is a framework change, so editing `main` in place would leave it broken for weeks.
- Vercel gives the branch its own preview URL automatically.
- Build the Next.js app in the repo root on the branch. The old `/frontend` and `/backend` stay beside it as reference until Phase 7, then get deleted in one commit before merging.

A brand-new repo is only worth it if you want to drop the Emergent history entirely. Nothing in the history is needed, but nothing there causes harm either.

---

## Decisions (confirmed 2026-09-27)

**1. Data:** No migration from Emergent. Start with a fresh Supabase database.

**2. Pricing:** One config file (`src/config/plans.ts`) is the only source for prices, Stripe lookup keys and entitlements. The UI, server-side gating and (later) Stripe all read from it.

- **Free, $0:** 3 mock questions per week · Basic question bank · Limited feedback
- **Essential, $9.99/month:** Unlimited practice · Answer feedback · Progress tracking
- **Pro, $19.99/month:**
  - 7-day free trial
  - Everything in Essential
  - AI voice mock interviews
  - Speech analysis
  - Optional body-language coaching
  - Personalized application/CV question bank
  - Program-specific preparation
- **Interview Season Pass, $69 one-time:** Full Pro access · Valid for the residency interview season, approximately September 23 through March 15 · No monthly renewal

Entitlements are flags (e.g. `voiceInterviews`, `speechAnalysis`, `bodyLanguage`, `cvQuestionBank`, `programPrep`, `weeklyQuestionLimit`). Code checks flags, never plan names.

**3. Media privacy:**
- Audio is captured, sent for transcription and analysis, and then discarded. Only the transcript and feedback are saved.
- Video needs explicit opt-in camera permission and is analyzed in-session only. Only derived coaching metrics are saved.
- To allow optional recordings later: a `recordings` table and private Storage bucket (`{user_id}/…`) will be designed but stay empty. They get written only when a per-user `save_recordings` consent flag is true (default false). The media pipeline accepts a `retain: boolean` from day one.

**4. Analytics:** None in Phase 1 (Emergent PostHog removed). Later, add a privacy-conscious provider behind a single `track(event, props)` wrapper with an allow-list of event names and non-sensitive props (signup, onboarding_completed, interview_started/completed, feature_used, plan_converted, error, retention). Transcripts, application materials, audio, video and free-text user content are never sent.
