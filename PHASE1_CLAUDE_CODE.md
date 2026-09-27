# Phase 1 — Claude Code instructions

Run from the root of a local clone of `chinonyeze/app`. Read `MIGRATION_PLAN.md` first (commit it along with this file). Execute the steps in order and stop at any **STOP** condition.

---

## 0. Ground rules

- **Do not redesign.** Keep the visual output identical to the current CRA app: same Tailwind classes, CSS variables, fonts, copy and layout. Only change routing, imports, types and the data layer.
- Don't touch `main` except to tag it. All work happens on `migration/nextjs-supabase`.
- Don't delete `/frontend`, `/backend` or `.emergent/` in this phase. They stay as reference.
- Don't implement Stripe, microphone/camera, AI calls or real auth.
- Never invent credentials. Use placeholders in `.env.example` only.
- Tell the user about anything ambiguous instead of guessing.

## 1. Preserve the original

```bash
git checkout main && git pull
git status   # STOP if the working tree is dirty; tell the user
git tag -a emergent-final -m "Original Emergent version before migration"
git push origin emergent-final
git checkout -b migration/nextjs-supabase
git push -u origin migration/nextjs-supabase
```

## 2. Scaffold Next.js in `/web`

Put the new app in `/web` so it sits beside the old `/frontend` and `/backend` without conflicts. It moves to the repo root in Phase 7.

```bash
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

- Pin **Tailwind 3.4.x** (downgrade if the scaffold installs v4) so the existing `tailwind.config.js` and `index.css` work unchanged. Add `tailwindcss-animate`, `autoprefixer`, and a `postcss.config.js` matching the old one.
- `tsconfig.json`: `"strict": true`. Allow `"allowJs": true` only temporarily if needed. The goal is all `.tsx`.
- Node version: add `"engines": { "node": ">=20" }` and an `.nvmrc` containing `20`.

## 3. Port styling (byte-for-byte)

| From `frontend/` | To `web/` |
|---|---|
| `src/index.css` | `src/app/globals.css`. Remove the Google Fonts `@import` line only; everything else stays identical. |
| `src/App.css` | merge into `globals.css` |
| `tailwind.config.js` | `tailwind.config.ts`. Same theme; update `content` to `./src/**/*.{ts,tsx}` |
| `components.json` | `components.json` (set `tsx: true`, `rsc: true`, paths to `@/components`, `@/lib/utils`) |
| `src/lib/utils.js` | `src/lib/utils.ts` |

Fonts: load **Outfit** (400–800), **Inter** (400–700) and **JetBrains Mono** (400, 600) with `next/font/google` in `src/app/layout.tsx`. Keep the family names so the existing `font-family` rules in `globals.css` still resolve, or expose them as CSS variables and point those rules at the variables. Rendered fonts must match.

## 4. Port shadcn/ui components

- Copy every file in `frontend/src/components/ui/` to `web/src/components/ui/` and convert to `.tsx`. Prefer regenerating each with `npx shadcn@latest add <name>` **only if** the output is visually identical. Otherwise hand-convert the existing file, adding types without changing classNames.
- Install exactly the Radix/aux packages those components import (see `frontend/package.json`). Don't carry over unused dependencies.
- `sonner.jsx` uses `next-themes`. Keep it working; the `<Toaster richColors position="top-right" />` in the root layout must behave the same.
- `hooks/use-toast.js` → `src/hooks/use-toast.ts`.

## 5. Centralized plan config

Create `web/src/config/plans.ts`. It is **the only place** prices, labels, lookup keys and entitlements live. Rewrite `components/Plans.jsx` (→ `src/components/Plans.tsx`) and the AppShell upgrade card/plan label to read from it. Search for and remove every hard-coded price string (`$9.99`, `$19.99`, `$69`, `7-day`, `Sept 23`, etc.) elsewhere in the UI.

```ts
export type PlanId = "free" | "essential" | "pro" | "season_pass";

export type Entitlements = {
  weeklyQuestionLimit: number | null;   // null = unlimited
  questionBank: "basic" | "personalized";
  answerFeedback: "limited" | "full";
  progressTracking: boolean;
  voiceInterviews: boolean;
  speechAnalysis: boolean;
  bodyLanguage: boolean;                // optional, requires camera opt-in
  cvQuestionBank: boolean;
  programPrep: boolean;
};

export type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  priceLabel: string;                   // "$9.99"
  cadence: "month" | "one_time" | null;
  cadenceLabel: string;                 // "/ month", "one-time", ""
  tagline: string;
  stripeLookupKey: string | null;       // used in Phase 6
  trialDays?: number;
  seasonWindow?: { startMonthDay: "09-23"; endMonthDay: "03-15" };
  highlight?: boolean;
  features: string[];                   // display bullets, verbatim below
  entitlements: Entitlements;
};

export const PLANS: Record<PlanId, Plan>;
export const PLAN_ORDER: PlanId[] = ["free", "essential", "pro", "season_pass"];
export function getEntitlements(plan: PlanId | null | undefined): Entitlements;
export function can(plan: PlanId | null | undefined, key: keyof Entitlements): boolean;
```

Display copy, used verbatim:

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

Lookup keys: `matchprep_essential_monthly`, `matchprep_pro_monthly`, `matchprep_season_pass_one_time`.
Season Pass entitlements = Pro entitlements (derive them in code; don't duplicate).

Keep the existing plan-card markup/classes. Only the data source changes. Tagline/badge text ("Most popular", "7-day free trial", trial note under price) should be generated from the config fields.

## 6. Routes (App Router)

```
src/app/
  layout.tsx                  root: fonts, globals.css, <Toaster/>, <Providers/>
  page.tsx                    Landing
  payment/success/page.tsx    PaymentSuccess (UI only, see §8)
  payment/cancel/page.tsx     PaymentCancel
  (app)/layout.tsx            AppShell (sidebar + mobile tabs), wraps children in place of <Outlet/>
  (app)/dashboard/page.tsx
  (app)/practice/page.tsx
  (app)/programs/page.tsx
  (app)/progress/page.tsx
  (app)/my-story/page.tsx
  login/page.tsx              placeholder (see §9)
  auth/callback/route.ts      placeholder (see §9)
  not-found.tsx
middleware.ts                 Supabase session refresh (see §9)
```

Porting rules for each page (`frontend/src/pages/*.jsx` → `.tsx`):
- `react-router-dom` → `next/link` (`<Link href>`), `usePathname` (NavLink active state, same classes), `useRouter().push/replace`.
- Add `"use client"` to interactive pages/components. Keep server components wherever there are no hooks.
- Keep every `data-testid`.
- Delete the `#session_id=` AuthCallback logic from `App.js` entirely.
- Replace `document.getElementById("features").scrollIntoView(...)` with `window.scrollTo({ top: el.offsetTop - headerHeight, behavior: "smooth" })` or an `href="#features"` anchor. The result must look the same.
- `@tanstack/react-query`: keep it only if a page actually uses it; if kept, put `QueryClientProvider` in `src/app/providers.tsx` with the same defaults (`staleTime: 60_000`, `refetchOnWindowFocus: false`).
- `Landing` "Sign in" / "Start free" → `router.push("/login")` (no Emergent URL).
- Page `<title>`/description via `metadata` in `layout.tsx`: title "MatchPrep AI — Residency interview prep", description taken from the landing hero sub-copy.

## 7. Data layer (no backend yet)

Create `src/lib/api.ts` exporting **the same function names** as `frontend/src/lib/api.js`, with TypeScript types for every request/response (derive them from `backend/server.py` models and return shapes; put the types in `src/types/api.ts`).

Phase 1 implementation: every function goes through one adapter:

```ts
// src/lib/api.ts
const LEGACY = process.env.NEXT_PUBLIC_LEGACY_API_URL; // optional, unset by default
```

- If `LEGACY` is **unset** (default), read functions return typed empty states (`[]`, `{ questions: [] }`, a zeroed progress summary, an empty profile) and write/AI functions throw a typed `NotImplementedError("Available in Phase 4")`. Pages must catch this and show the existing toast/error UI, not crash.
- If `LEGACY` is set, call the old FastAPI with axios `withCredentials` exactly as before. This is only useful for side-by-side comparison; it won't authenticate outside Emergent.
- Remove `exchangeSession`. Keep `getMe`/`logout` signatures, but back them with the auth adapter in §9.

## 8. Features explicitly stubbed

- **Stripe:** plan CTA buttons stay rendered with the same styling. On click, show `toast("Checkout is coming soon")`. No `createCheckout` network call. PaymentSuccess renders its success UI without polling.
- **Microphone/camera:** in Practice, keep the full layout (personality/mode pickers, transcript panel, controls). Do **not** call `getUserMedia` or `MediaRecorder`. The start button shows a toast "Voice interviews are coming soon". Move the existing media code into `src/features/practice/legacy-media.ts` with a header comment (not imported) so Phase 4 can reuse it.
- **AI endpoints:** stubbed per §7.

Leave a short `// PHASE-N:` comment at each stub so they can be found with grep.

## 9. Supabase preparation (no real auth yet)

```bash
cd web && npm i @supabase/supabase-js @supabase/ssr
```

Create:
- `src/lib/supabase/client.ts`: `createBrowserClient` from env.
- `src/lib/supabase/server.ts`: `createServerClient` using `cookies()` from `next/headers`.
- `src/lib/supabase/middleware.ts` + root `middleware.ts`: the standard `@supabase/ssr` session-refresh pattern. **If the env vars are missing, pass the request through unchanged** so the app runs without Supabase. Do not block `(app)` routes in Phase 1; add a `// PHASE-3: redirect unauthenticated users` marker.
- `src/lib/auth.ts`: `getUser()` / `signOut()` adapter used by `AuthProvider` (`src/context/AuthContext.tsx`, same `{ user, loading, logout, refresh }` shape). In Phase 1, when Supabase isn't configured it returns a stable **dev preview user** (`{ id: "dev", name: "Preview User", email: "preview@local", plan: "free" }`) so AppShell renders. Gate this behind `NODE_ENV !== "production"`; in production with no Supabase it returns `null`.
- `src/app/login/page.tsx`: a simple placeholder using the existing Card/Button/Input styling, with the message "Sign-in is being set up." No forms that submit.
- `src/app/auth/callback/route.ts`: placeholder that redirects to `/dashboard` with a `// PHASE-3` marker.
- `src/types/database.ts`: empty placeholder with a comment explaining it will be generated by `supabase gen types` in Phase 2.
- `src/config/media.ts`: `export const MEDIA_POLICY = { retainAudio: false, retainVideo: false, videoRequiresOptIn: true } as const;` (future recording feature reads this plus a per-user consent flag).
- `src/lib/analytics.ts`: `export function track(_event: AllowedEvent, _props?: SafeProps) {}` no-op, with the allow-listed event union from `MIGRATION_PLAN.md`. Don't install any provider.

## 10. Environment & secrets

`web/.env.example`:

```bash
# Supabase (Phase 2/3) — Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=            # server only, never NEXT_PUBLIC_

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# AI (Phase 4)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Stripe (Phase 6)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Optional, comparison only — old FastAPI base URL
NEXT_PUBLIC_LEGACY_API_URL=
```

Add a typed env reader `src/lib/env.ts` that returns `undefined` for missing values (don't throw at import time in Phase 1).

Root `.gitignore`: add

```
.env
.env.*
!.env.example
**/.env
**/.env.*
!**/.env.example
web/.next/
web/out/
.vercel
```

Then run `git ls-files | grep -E '(^|/)\.env'`. STOP if any real env file is tracked; tell the user.

## 11. Emergent removal (new app only)

`web/` must contain **none** of the following. Verify with grep at the end:

```bash
grep -rniE "emergent|posthog|phc_|assets\.emergent|craco|react-scripts|REACT_APP_" web/src web/package.json web/next.config.* && echo "FAIL" || echo "clean"
```

Not carried over: `@emergentbase/visual-edits`, `emergent-main.js`, PostHog snippet, `plugins/health-check`, `craco.config.js`, `constants/testIds` Emergent references (keep the test-ID values themselves if pages use them), "Emergent | Fullstack App" title.

## 12. Build, lint, fix

```bash
cd web
npm install
npx tsc --noEmit
npm run lint
npm run build
```

Fix every error. Don't use `// @ts-ignore`, `any`-casting whole modules, or `eslint-disable` for whole files to get green. Narrow `unknown` properly. If something can't be fixed without a design change, STOP and tell the user.

Then `npm run start` and check each route renders with no console errors:
`/`, `/login`, `/dashboard`, `/practice`, `/programs`, `/progress`, `/my-story`, `/payment/success`, `/payment/cancel`, and a 404.

**Visual parity check:** if the old app can still be run (`cd frontend && yarn && yarn start` — remove the visual-edits devDependency locally *without committing* if install fails), compare each page side by side at 1440px and 390px widths. List any differences.

## 13. Add a README and commit

# Phase 1 — Claude Code instructions

Run from the root of a local clone of `chinonyeze/app`. Read `MIGRATION_PLAN.md` first (commit it along with this file). Execute the steps in order and stop at any **STOP** condition.

---

## 0. Ground rules

- **Do not redesign.** Keep the visual output identical to the current CRA app: same Tailwind classes, CSS variables, fonts, copy and layout. Only change routing, imports, types and the data layer.
- Don't touch `main` except to tag it. All work happens on `migration/nextjs-supabase`.
- Don't delete `/frontend`, `/backend` or `.emergent/` in this phase. They stay as reference.
- Don't implement Stripe, microphone/camera, AI calls or real auth.
- Never invent credentials. Use placeholders in `.env.example` only.
- Tell the user about anything ambiguous instead of guessing.

## 1. Preserve the original

```bash
git checkout main && git pull
git status   # STOP if the working tree is dirty; tell the user
git tag -a emergent-final -m "Original Emergent version before migration"
git push origin emergent-final
git checkout -b migration/nextjs-supabase
git push -u origin migration/nextjs-supabase
```

## 2. Scaffold Next.js in `/web`

Put the new app in `/web` so it sits beside the old `/frontend` and `/backend` without conflicts. It moves to the repo root in Phase 7.

```bash
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

- Pin **Tailwind 3.4.x** (downgrade if the scaffold installs v4) so the existing `tailwind.config.js` and `index.css` work unchanged. Add `tailwindcss-animate`, `autoprefixer`, and a `postcss.config.js` matching the old one.
- `tsconfig.json`: `"strict": true`. Allow `"allowJs": true` only temporarily if needed. The goal is all `.tsx`.
- Node version: add `"engines": { "node": ">=20" }` and an `.nvmrc` containing `20`.

## 3. Port styling (byte-for-byte)

| From `frontend/` | To `web/` |
|---|---|
| `src/index.css` | `src/app/globals.css`. Remove the Google Fonts `@import` line only; everything else stays identical. |
| `src/App.css` | merge into `globals.css` |
| `tailwind.config.js` | `tailwind.config.ts`. Same theme; update `content` to `./src/**/*.{ts,tsx}` |
| `components.json` | `components.json` (set `tsx: true`, `rsc: true`, paths to `@/components`, `@/lib/utils`) |
| `src/lib/utils.js` | `src/lib/utils.ts` |

Fonts: load **Outfit** (400–800), **Inter** (400–700) and **JetBrains Mono** (400, 600) with `next/font/google` in `src/app/layout.tsx`. Keep the family names so the existing `font-family` rules in `globals.css` still resolve, or expose them as CSS variables and point those rules at the variables. Rendered fonts must match.

## 4. Port shadcn/ui components

- Copy every file in `frontend/src/components/ui/` to `web/src/components/ui/` and convert to `.tsx`. Prefer regenerating each with `npx shadcn@latest add <name>` **only if** the output is visually identical. Otherwise hand-convert the existing file, adding types without changing classNames.
- Install exactly the Radix/aux packages those components import (see `frontend/package.json`). Don't carry over unused dependencies.
- `sonner.jsx` uses `next-themes`. Keep it working; the `<Toaster richColors position="top-right" />` in the root layout must behave the same.
- `hooks/use-toast.js` → `src/hooks/use-toast.ts`.

## 5. Centralized plan config

Create `web/src/config/plans.ts`. It is **the only place** prices, labels, lookup keys and entitlements live. Rewrite `components/Plans.jsx` (→ `src/components/Plans.tsx`) and the AppShell upgrade card/plan label to read from it. Search for and remove every hard-coded price string (`$9.99`, `$19.99`, `$69`, `7-day`, `Sept 23`, etc.) elsewhere in the UI.

```ts
export type PlanId = "free" | "essential" | "pro" | "season_pass";

export type Entitlements = {
  weeklyQuestionLimit: number | null;   // null = unlimited
  questionBank: "basic" | "personalized";
  answerFeedback: "limited" | "full";
  progressTracking: boolean;
  voiceInterviews: boolean;
  speechAnalysis: boolean;
  bodyLanguage: boolean;                // optional, requires camera opt-in
  cvQuestionBank: boolean;
  programPrep: boolean;
};

export type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  priceLabel: string;                   // "$9.99"
  cadence: "month" | "one_time" | null;
  cadenceLabel: string;                 // "/ month", "one-time", ""
  tagline: string;
  stripeLookupKey: string | null;       // used in Phase 6
  trialDays?: number;
  seasonWindow?: { startMonthDay: "09-23"; endMonthDay: "03-15" };
  highlight?: boolean;
  features: string[];                   // display bullets, verbatim below
  entitlements: Entitlements;
};

export const PLANS: Record<PlanId, Plan>;
export const PLAN_ORDER: PlanId[] = ["free", "essential", "pro", "season_pass"];
export function getEntitlements(plan: PlanId | null | undefined): Entitlements;
export function can(plan: PlanId | null | undefined, key: keyof Entitlements): boolean;
```

Display copy, used verbatim:

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

Lookup keys: `matchprep_essential_monthly`, `matchprep_pro_monthly`, `matchprep_season_pass_one_time`.
Season Pass entitlements = Pro entitlements (derive them in code; don't duplicate).

Keep the existing plan-card markup/classes. Only the data source changes. Tagline/badge text ("Most popular", "7-day free trial", trial note under price) should be generated from the config fields.

## 6. Routes (App Router)

```
src/app/
  layout.tsx                  root: fonts, globals.css, <Toaster/>, <Providers/>
  page.tsx                    Landing
  payment/success/page.tsx    PaymentSuccess (UI only, see §8)
  payment/cancel/page.tsx     PaymentCancel
  (app)/layout.tsx            AppShell (sidebar + mobile tabs), wraps children in place of <Outlet/>
  (app)/dashboard/page.tsx
  (app)/practice/page.tsx
  (app)/programs/page.tsx
  (app)/progress/page.tsx
  (app)/my-story/page.tsx
  login/page.tsx              placeholder (see §9)
  auth/callback/route.ts      placeholder (see §9)
  not-found.tsx
middleware.ts                 Supabase session refresh (see §9)
```

Porting rules for each page (`frontend/src/pages/*.jsx` → `.tsx`):
- `react-router-dom` → `next/link` (`<Link href>`), `usePathname` (NavLink active state, same classes), `useRouter().push/replace`.
- Add `"use client"` to interactive pages/components. Keep server components wherever there are no hooks.
- Keep every `data-testid`.
- Delete the `#session_id=` AuthCallback logic from `App.js` entirely.
- Replace `document.getElementById("features").scrollIntoView(...)` with `window.scrollTo({ top: el.offsetTop - headerHeight, behavior: "smooth" })` or an `href="#features"` anchor. The result must look the same.
- `@tanstack/react-query`: keep it only if a page actually uses it; if kept, put `QueryClientProvider` in `src/app/providers.tsx` with the same defaults (`staleTime: 60_000`, `refetchOnWindowFocus: false`).
- `Landing` "Sign in" / "Start free" → `router.push("/login")` (no Emergent URL).
- Page `<title>`/description via `metadata` in `layout.tsx`: title "MatchPrep AI — Residency interview prep", description taken from the landing hero sub-copy.

## 7. Data layer (no backend yet)

Create `src/lib/api.ts` exporting **the same function names** as `frontend/src/lib/api.js`, with TypeScript types for every request/response (derive them from `backend/server.py` models and return shapes; put the types in `src/types/api.ts`).

Phase 1 implementation: every function goes through one adapter:

```ts
// src/lib/api.ts
const LEGACY = process.env.NEXT_PUBLIC_LEGACY_API_URL; // optional, unset by default
```

- If `LEGACY` is **unset** (default), read functions return typed empty states (`[]`, `{ questions: [] }`, a zeroed progress summary, an empty profile) and write/AI functions throw a typed `NotImplementedError("Available in Phase 4")`. Pages must catch this and show the existing toast/error UI, not crash.
- If `LEGACY` is set, call the old FastAPI with axios `withCredentials` exactly as before. This is only useful for side-by-side comparison; it won't authenticate outside Emergent.
- Remove `exchangeSession`. Keep `getMe`/`logout` signatures, but back them with the auth adapter in §9.

## 8. Features explicitly stubbed

- **Stripe:** plan CTA buttons stay rendered with the same styling. On click, show `toast("Checkout is coming soon")`. No `createCheckout` network call. PaymentSuccess renders its success UI without polling.
- **Microphone/camera:** in Practice, keep the full layout (personality/mode pickers, transcript panel, controls). Do **not** call `getUserMedia` or `MediaRecorder`. The start button shows a toast "Voice interviews are coming soon". Move the existing media code into `src/features/practice/legacy-media.ts` with a header comment (not imported) so Phase 4 can reuse it.
- **AI endpoints:** stubbed per §7.

Leave a short `// PHASE-N:` comment at each stub so they can be found with grep.

## 9. Supabase preparation (no real auth yet)

```bash
cd web && npm i @supabase/supabase-js @supabase/ssr
```

Create:
- `src/lib/supabase/client.ts`: `createBrowserClient` from env.
- `src/lib/supabase/server.ts`: `createServerClient` using `cookies()` from `next/headers`.
- `src/lib/supabase/middleware.ts` + root `middleware.ts`: the standard `@supabase/ssr` session-refresh pattern. **If the env vars are missing, pass the request through unchanged** so the app runs without Supabase. Do not block `(app)` routes in Phase 1; add a `// PHASE-3: redirect unauthenticated users` marker.
- `src/lib/auth.ts`: `getUser()` / `signOut()` adapter used by `AuthProvider` (`src/context/AuthContext.tsx`, same `{ user, loading, logout, refresh }` shape). In Phase 1, when Supabase isn't configured it returns a stable **dev preview user** (`{ id: "dev", name: "Preview User", email: "preview@local", plan: "free" }`) so AppShell renders. Gate this behind `NODE_ENV !== "production"`; in production with no Supabase it returns `null`.
- `src/app/login/page.tsx`: a simple placeholder using the existing Card/Button/Input styling, with the message "Sign-in is being set up." No forms that submit.
- `src/app/auth/callback/route.ts`: placeholder that redirects to `/dashboard` with a `// PHASE-3` marker.
- `src/types/database.ts`: empty placeholder with a comment explaining it will be generated by `supabase gen types` in Phase 2.
- `src/config/media.ts`: `export const MEDIA_POLICY = { retainAudio: false, retainVideo: false, videoRequiresOptIn: true } as const;` (future recording feature reads this plus a per-user consent flag).
- `src/lib/analytics.ts`: `export function track(_event: AllowedEvent, _props?: SafeProps) {}` no-op, with the allow-listed event union from `MIGRATION_PLAN.md`. Don't install any provider.

## 10. Environment & secrets

`web/.env.example`:

```bash
# Supabase (Phase 2/3) — Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=            # server only, never NEXT_PUBLIC_

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# AI (Phase 4)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Stripe (Phase 6)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Optional, comparison only — old FastAPI base URL
NEXT_PUBLIC_LEGACY_API_URL=
```

Add a typed env reader `src/lib/env.ts` that returns `undefined` for missing values (don't throw at import time in Phase 1).

Root `.gitignore`: add

```
.env
.env.*
!.env.example
**/.env
**/.env.*
!**/.env.example
web/.next/
web/out/
.vercel
```

Then run `git ls-files | grep -E '(^|/)\.env'`. STOP if any real env file is tracked; tell the user.

## 11. Emergent removal (new app only)

`web/` must contain **none** of the following. Verify with grep at the end:

```bash
grep -rniE "emergent|posthog|phc_|assets\.emergent|craco|react-scripts|REACT_APP_" web/src web/package.json web/next.config.* && echo "FAIL" || echo "clean"
```

Not carried over: `@emergentbase/visual-edits`, `emergent-main.js`, PostHog snippet, `plugins/health-check`, `craco.config.js`, `constants/testIds` Emergent references (keep the test-ID values themselves if pages use them), "Emergent | Fullstack App" title.

## 12. Build, lint, fix

```bash
cd web
npm install
npx tsc --noEmit
npm run lint
npm run build
```

Fix every error. Don't use `// @ts-ignore`, `any`-casting whole modules, or `eslint-disable` for whole files to get green. Narrow `unknown` properly. If something can't be fixed without a design change, STOP and tell the user.

Then `npm run start` and check each route renders with no console errors:
`/`, `/login`, `/dashboard`, `/practice`, `/programs`, `/progress`, `/my-story`, `/payment/success`, `/payment/cancel`, and a 404.

**Visual parity check:** if the old app can still be run (`cd frontend && yarn && yarn start` — remove the visual-edits devDependency locally *without committing* if install fails), compare each page side by side at 1440px and 390px widths. List any differences.

## 13. Add a README and commit

- `web/README.md`: setup (`cp .env.example .env.local`, `npm i`, `npm run dev`), the phase status, and the `PHASE-N` grep tip.
- Commit in logical steps (scaffold → styles/ui → plans config → pages → supabase prep → env/gitignore → fixes). Push the branch.

## 14. Report back (paste into chat)

1. **What changed:** files created, dependencies added, anything that deviated from these instructions and why.
2. **Build result:** `tsc`, `lint`, `build` outputs (last ~20 lines each).
3. **Still depends on the old backend / stubbed:** list every `PHASE-N` marker, grouped by phase.
4. **Visual differences** found in the parity check, if any.
5. **Manual steps the user must do** (at minimum):
   - Create a Supabase project, then copy the URL and anon key into `web/.env.local` (and later Vercel).
   - Create a Vercel project with Root Directory = `web` and add the env vars.
   - Confirm the preview deployment matches the old design.
   - Don't merge to `main` yet.

**Do not start Phase 2.**
