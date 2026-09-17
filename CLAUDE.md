# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Frontend (Next.js 16 / React 19 / TypeScript) for a multi-tenant BTP (construction)
site-management SaaS, "CCD Digital". It talks to a separate Django backend
(`backend/apps/<module>/`, not in this repo) over a JSON REST API. **The entire
codebase — identifiers, comments, commit-worthy docs — is written in French**;
match that convention in any code you write here.

## Commands

```bash
npm run dev            # start dev server (Turbopack), http://localhost:3000
npm run build          # production build
npm run lint           # ESLint — includes project-specific rules, see below
npm run typecheck      # tsc --noEmit
npm run recette:capture -- --base=http://demo.localhost:3002 --dossier=avant
```

`lint` and `typecheck` also run in CI, *before* the build — a failure stops the
deployment rather than shipping it.

There is no test runner configured yet. `/design-system` is a live catalogue
of every UI component (buttons, fields, badges, tables, alerts) — check it
when touching `src/components/ui`.

`recette:capture` is the **visual reference**: Playwright walks the product's
real screens at 1440 / 768 / 390 px and writes PNGs to `docs/recette/<dossier>/`.
With no test suite, this is the only thing that can prove a refactor changed
nothing on screen — which is literally the acceptance criterion of lot 1. See
`docs/recette/README.md`.

Demo login against a connected backend: `admin@demo.ci` / `Demo1234!`.

## Multi-tenancy: the subdomain *is* the tenant

The API base URL is **never hardcoded** — it's derived from the browser's
subdomain (`src/lib/api/client.ts`, `baseApi()`). `sotra.ccd-digital.ci` calls
`sotra.ccd-digital.ci`; the same build serves every client company. Locally,
subdomains work through `*.localhost` (e.g. `demo.localhost:8000`), and
`NEXT_PUBLIC_API_PORT` bridges the port mismatch (`3000` frontend / `8000`
API) that doesn't exist in production.

`NEXT_PUBLIC_API_URL` (an override) and `apiPlateforme`/`basePlateforme()` are
the two escape hatches, each dangerous in its own way:
- `NEXT_PUBLIC_API_URL` pins the frontend to one tenant — fine for isolated
  local debugging, wrong for anything else (a freshly-registered client would
  get their login checked against the wrong company's database).
- `apiPlateforme` targets the *platform* schema (signup, billing — endpoints
  that don't live under any client subdomain). Use `api` (tenant-scoped) for
  everything else. Picking the wrong one fails silently as a 404, not an
  auth error.

## HTTP client (`src/lib/api/client.ts`)

Thin `fetch` wrapper — no axios (Next instruments `fetch` for caching).
Handles, once, so screens don't reimplement it:
- Bearer token attachment from `src/lib/api/jetons.ts`.
- **Single in-flight token refresh on 401** (`renouvellementPartage`) —
  concurrent requests share one refresh instead of racing and mutually
  logging each other out. The refresh token **rotates** on every use; keeping
  only `access` from a refresh response would replay a dead refresh token.
- Distinguishing network failure (`reseau_indisponible`) from an application
  error (`ErreurApi`, `src/lib/api/erreurs.ts`), which carries a stable
  `code` — branch on `code`, never on `message` (message is for humans and
  gets reworded).
- A 401 that survives refresh fires `EVENEMENT_SESSION_EXPIREE` on `window`;
  the HTTP layer never redirects itself (unusable outside a browser) — see
  `SurveillantSession` for the consumer.

`NEXT_PUBLIC_API_SIMULE=1` (dev default) routes onboarding/config/subscription
screens through `src/lib/api/simulation.ts` instead of real endpoints not yet
written server-side; it replays the same contracts, errors included, so
flipping it to `0` requires no screen changes. Screens under simulation must
show the "simulated data" banner (`BandeauSimulation`).

## Session management (`src/lib/auth/session.ts`)

Two independent clocks: inactivity (30 min, extendable, warnings at 15/5 min)
and an absolute session cap (8 h, never extends). Synced across tabs via
`BroadcastChannel`. Real user input (`pointerdown`/`keydown`/`touchstart`)
resets the inactivity clock; the 8h cap is architecturally non-negotiable.
Also debounce-saves open form values to `sessionStorage` on session teardown
(excludes password fields and anything tagged `data-sans-sauvegarde`).

## Dev-only tooling (`src/dev/`)

Gated by **two independent locks**, both required: `NEXT_PUBLIC_OUTILS_TEST=1`
in an untracked `.env.local`, *and* a localhost-family hostname. Deliberately
**not** `NODE_ENV` — this app runs `next start` (i.e. `NODE_ENV=production`)
on developer machines too, so `NODE_ENV` would hide the tools from the people
who need them while giving a false sense of protection. Never ship anything
that reads `src/dev/*` into a screen a client can reach.

## i18n and the "no hardcoded string" rule

French only today (`src/i18n/langue.ts`), but the architecture already
supports adding a second language without touching functional code — the
locale is resolved once, in `src/i18n/request.ts`. Component text goes through
`t("…")` (next-intl); non-component code (e.g. `lib/api`) goes through
`texte()` from `@/i18n/horsReact`.

`eslint.config.mjs` enforces this at two independent layers, and both are
errors, not warnings:
1. `i18next/no-literal-string` (jsx-only) — catches literal JSX text/attributes.
2. A custom `no-restricted-syntax` rule banning **any accented French
   character or French sentence shape in a literal, anywhere in `.ts`/`.tsx`**
   — this is what catches validation messages built in plain JS
   (`"La ville est requise."`), label arrays (`MODULES_CCD`, `PALETTE_OFFICIELLE`),
   and static `metadata` exports (must use `generateMetadata()` +
   `getTranslations` instead).

A small, explicit, file-level allowlist exists for files that carry *data*,
not UI copy (referentials, the simulation layer, `/design-system`, `messages/`
itself) — see the comments in `eslint.config.mjs` before adding to it. Every
exemption there must be justifiable in one line; don't add directory-wide
exemptions.

## Directory layout

- `src/app/(app)/`, `(auth)/`, `(public)/` — route groups: authenticated app,
  auth flows (login/activation/invitation/password), and public pages
  (signup, share links) respectively.
- `src/features/<domain>/` — hooks, API calls, types per business domain,
  each one mirroring a Django app (`features/projets` ↔ `backend/apps/projets/`,
  `features/chantier` ↔ `backend/apps/chantier/`, `features/finance` ↔
  `backend/apps/finance/`, etc.). Put domain logic here, not in `app/`.
- `src/components/ui/` — the design system (Bouton, Champ, Badge, Tableau,
  Modale…), generic and reusable.
- `src/components/metier/` — components that bake in BTP/regional business
  rules that a generic library wouldn't have: e.g. `ChampTelephone` **stores**
  E.164 (`+2250700000000`) but **displays** a local format, because the
  WhatsApp deep link the server builds needs the country code; `SelecteurVille`
  follows the company's country, sourced from the server, not user-editable.
  The city (`features/referentiels/villes.ts`, **generated** from the Python
  referential) and phone (`telephone.ts`, hand-written) lists must stay
  in sync — both are closed to the same nine signup countries.
- `src/components/layout/` — nav, header, breadcrumb, footer.
- `src/lib/api/` — HTTP client, token storage, error types, simulation layer.
- `src/lib/auth/` — session clocks, route guards, `SurveillantSession`.
- `src/types/` — TypeScript types generated from the backend's OpenAPI
  contract; don't hand-edit generated sections.
- `src/dev/` — dev-only test harness, double-gated (see above).

## React Query conventions (`src/app/providers.tsx`)

`staleTime: 30s`, `gcTime: 5min`, `refetchOnWindowFocus: false`. Queries never
retry a 4xx (`ErreurApi.estTemporaire` gates retry — permission/business-rule
errors won't resolve by repeating them, and repeating them wastes seconds on
a slow site connection). Mutations never auto-retry — a duplicated write costs
more than a visible failure the user can retry themselves. The `QueryClient`
is created in `useState`, not module scope, so SSR doesn't leak one user's
cache into another's request.

## Path alias

`@/*` → `./src/*` (see `tsconfig.json`).

## Refonte in progress — read this before writing anything

The codebase is migrating towards `docs/ARCHITECTURE_REUTILISABLE.md`, in
numbered lots (`docs/plan_refont.md`), against the findings of
`docs/DIAGNOSTIC_ARCHITECTURE.md`. **Lot 0 is done.** Until the last lot lands,
two styling systems and two icon sets coexist on purpose, and the rules below
are what keeps that coexistence from turning into a mess.

### Decisions already taken — do not "fix" them back

- **A1 — `src/features/<domaine>/` stays**, against the reference doc's
  `lib/<domaine>/`. This is a **deliberate divergence**: what the doc mandates
  is the *stratification*, not the folder name, and `features/projets` ↔
  `backend/apps/projets/` is an invariant worth more than a rename of 116
  files. The five layers go *inside* each domain folder:
  `types.ts` (domain types, no HTTP shape) · `regles.ts` (pure business rules,
  zero React) · `validations.ts` (zod schemas for writes) · `adaptateur.ts`
  (API ↔ domain mapping, ex-`api.ts`) · `actions.ts` (`"use server"`) ·
  `components/`.
- **A2 — lucide-react, by strangulation.** No *new* `@phosphor-icons/react`
  import; the 26 existing files migrate when another lot touches them anyway.
  An ESLint `no-restricted-imports` rule enforces this from lot 2 on.
- **A3 — no dark mode.** An unreachable dark theme is CSS that rots, not a
  feature on hold. It can come back later, and will be far simpler once the
  tokens are reconciled.
- **A4 — target is the `httpOnly` cookie session** (option B of the plan):
  Django posts the session cookie at login, which turns the route guard into a
  real guard and unlocks server actions and server rendering. Until the backend
  delivers it, `jetons.ts` keeps its in-memory access token + `localStorage`
  refresh token, and lot 5 stays on its fallback variant. Lots 0-4 and 6 are
  written to pay off either way.

### Rules while both systems coexist

1. **A screen is migrated entirely or not at all.** Never half Tailwind, half
   CSS Module in the same file — that destroys the visual reference.
2. **No new `*.module.css`.** New screens are Tailwind + shadcn.
3. **No new colour in `style={{}}`** — it goes through a status tone
   (`components/statut/tons.ts`) or a charte utility.
4. **No hardcoded value**: not a colour, not a spacing, not a radius.
   `src/styles/tokens.css` is the single source; add the token there or don't
   use the value.
5. **No new `fetch` outside `features/<domaine>/adaptateur.ts`.**
6. **No new business rule inside a component** — it belongs in `regles.ts`.
7. **No new `@phosphor-icons/react` import** (A2).
8. The i18n rules do not relax: any exemption added to `eslint.config.mjs` is
   **one file**, never a directory, and justifies itself in one line.

### What lot 0 established

- `package.json` pins `packageManager` and now **declares the whole dependency
  set**. The Tailwind/shadcn/lucide/date-fns stack had been installed without
  being saved: present in `node_modules`, absent from `package.json` *and* the
  lockfile, so `npm ci` in CI produced a different tree than any dev machine.
  Nothing imports them yet — wiring Tailwind up is lot 1.
- CI runs `lint` and `typecheck` before the build.
- `docs/recette/avant/` holds the visual reference, and `docs/` is versioned
  (it carries the refonte's tracking documents).
