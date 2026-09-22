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
when touching `components/ui`.

`recette:capture` is the **visual reference**: Playwright walks the product's
real screens at 1440 / 768 / 390 px and writes PNGs to `docs/recette/<dossier>/`.
With no test suite, this is the only thing that can prove a refactor changed
nothing on screen — which is literally the acceptance criterion of lot 1. See
`docs/recette/README.md`.

Demo login against a connected backend: `admin@demo.ci` / `Demo1234!`.

## Multi-tenancy: the subdomain *is* the tenant

The API base URL is **never hardcoded** — it's derived from the browser's
subdomain (`lib/api/client.ts`, `baseApi()`). `sotra.ccd-digital.ci` calls
`sotra.ccd-digital.ci`; the same build serves every client company. Locally,
subdomains work through `*.localhost` (e.g. `demo.localhost:8000`), and
`NEXT_PUBLIC_API_PORT` bridges the port mismatch (`3000` frontend / `8000`
API) that doesn't exist in production.

`NEXT_PUBLIC_API_URL` (an override) and `apiPlateforme`/`basePlateforme()` are
the two escape hatches, each dangerous in its own way:
- `NEXT_PUBLIC_API_URL` pins the frontend to one tenant — fine for isolated
  local debugging, wrong for anything else (a freshly-registered client would
  get their login checked against the wrong company's database).
- `apiPlateforme` targets the *platform* schema (signup — endpoints that
  don't live under any client subdomain). Use `api` (tenant-scoped) for
  everything else. Picking the wrong one fails silently as a 404, not an
  auth error.

## There are two spaces, not one

The product has **two distinct spaces**, and the frontend used to know only
the first:

- the **tenant space**, one subdomain per client company — everything under
  `app/(app)/`, `(auth)/`, `(public)/`;
- the **platform admin space** (`ccd-digital.ci/admin`), the SaaS editor's
  back-office: clients, subscriptions, billing, support. It lives under
  `app/(admin)/` and `app/(admin-auth)/`, and its domain is
  `features/administration/`.

They never overlap, and the separation is structural rather than conditional:

- **Two account tables server-side.** A platform agent is not a role of a
  tenant user. Hence `apiAdministration` (a third client object, next to `api`
  and `apiPlateforme`) which prefixes `/administration`, targets
  `basePlateforme()` and presents the tokens of the `administration` space.
  `apiPlateforme` stays anonymous — it serves signup, which must not carry an
  admin token.
- **Two token sets** (`lib/api/jetons.ts`, keyed by `EspaceSession`). Signing
  into the back-office does not clobber a tenant session open in the next tab,
  and each space has its own refresh endpoint, timer and
  `EVENEMENT_SESSION_*_EXPIREE`. `demarrerRenouvellementAuto(espace)` and
  `effacerJetons(espace)` default to `"entreprise"`.
- **Two shells.** `app/(admin)/admin/layout.tsx` shares nothing with
  `app/(app)/layout.tsx`, which loads subscription, company, weather and the
  client's white-label colour — none of which a platform agent has.
- **Two permission models.** `features/roles` (12 BTP modules × 4 levels) is
  intra-tenant; `RoleAdministrateur` (`SUPERVISEUR` / `SUPPORT`) is the
  platform's. Do not merge them.

**The whole `/administration/*` API is simulated**
(`lib/api/simulationAdministration.ts`): no endpoint exists server-side yet.
The real calls sit in `adaptateur.ts` at their final place, so flipping
`NEXT_PUBLIC_API_SIMULE` changes no screen. Admin screens carry
`<BandeauSimulation contexte="administration" />`.

**The route guard is not a security boundary.** There is no `middleware.ts`;
until the `httpOnly` cookie of decision A4 lands, the real barrier is Django
refusing `/administration/*` to any token that is not an administrator's.

## HTTP client (`lib/api/client.ts`)

Thin `fetch` wrapper — no axios (Next instruments `fetch` for caching).
Handles, once, so screens don't reimplement it:
- Bearer token attachment from `lib/api/jetons.ts`.
- **Single in-flight token refresh on 401** (`renouvellementPartage`) —
  concurrent requests share one refresh instead of racing and mutually
  logging each other out. The refresh token **rotates** on every use; keeping
  only `access` from a refresh response would replay a dead refresh token.
- Distinguishing network failure (`reseau_indisponible`) from an application
  error (`ErreurApi`, `lib/api/erreurs.ts`), which carries a stable
  `code` — branch on `code`, never on `message` (message is for humans and
  gets reworded).
- A 401 that survives refresh fires `EVENEMENT_SESSION_EXPIREE` on `window`;
  the HTTP layer never redirects itself (unusable outside a browser) — see
  `SurveillantSession` for the consumer.

`NEXT_PUBLIC_API_SIMULE=1` (dev default) routes onboarding/config/subscription
screens through `lib/api/simulation.ts` instead of real endpoints not yet
written server-side; it replays the same contracts, errors included, so
flipping it to `0` requires no screen changes. Screens under simulation must
show the "simulated data" banner (`BandeauSimulation`).

## Session management — the session is kept alive, not timed out

**There is no client-side expiry any more.** The two clocks (30 min
inactivity with 15/5 min warning modal, plus an 8 h absolute cap), the
`BroadcastChannel` sync, the activity listeners and `ModalSession` are all
gone. They were the reported bug: a clock kept in `localStorage` decided on
its own to send the user back to `/connexion?session=expiree` with perfectly
valid tokens — and being client-side, it enforced nothing a user couldn't
reset by clearing storage. If that policy is wanted, only Django can hold it.

What replaces them, in `lib/api/`:
- **Both tokens persist in `localStorage`** (`jetons.ts`). The access token
  used to live in memory only, so every page reload started with no
  `Authorization` header, four parallel 401s, and a session that survived
  only if that one refresh won the race. Reloading now carries a real token.
- **`demarrerRenouvellementAuto()`** (`client.ts`, started once by
  `SurveillantSession`) renews the access token 60 s *before* its JWT `exp`,
  and catches up on `visibilitychange`/`focus`/`online` — a slept machine has
  suspended timers, which is exactly when the user comes back to a dead token.
- **Only the server ends a session.** `renouvelerJeton` fires
  `EVENEMENT_SESSION_EXPIREE` solely on a 400/401/403 from the refresh
  endpoint; a network failure or a 5xx keeps the tokens and retries. A 401
  from any other endpoint no longer logs anyone out while a refresh token
  remains — the ceiling is now whatever `SIMPLE_JWT` says server-side.

`lib/auth/session.ts` keeps only what never had to do with expiry: the
return route and the debounce-save of open form values to `sessionStorage`
(excluding password fields and anything tagged `data-sans-sauvegarde`).

## Dev-only tooling (`dev/`)

Gated by **two independent locks**, both required: `NEXT_PUBLIC_OUTILS_TEST=1`
in an untracked `.env.local`, *and* a localhost-family hostname. Deliberately
**not** `NODE_ENV` — this app runs `next start` (i.e. `NODE_ENV=production`)
on developer machines too, so `NODE_ENV` would hide the tools from the people
who need them while giving a false sense of protection. Never ship anything
that reads `dev/*` into a screen a client can reach.

## i18n and the "no hardcoded string" rule

French only today (`i18n/langue.ts`), but the architecture already
supports adding a second language without touching functional code — the
locale is resolved once, in `i18n/request.ts`. Component text goes through
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

- `app/(app)/`, `(auth)/`, `(public)/` — route groups: authenticated app,
  auth flows (login/activation/invitation/password), and public pages
  (signup, share links) respectively.
- `features/<domain>/` — hooks, API calls, types per business domain,
  each one mirroring a Django app (`features/projets` ↔ `backend/apps/projets/`,
  `features/chantier` ↔ `backend/apps/chantier/`, `features/finance` ↔
  `backend/apps/finance/`, etc.). Put domain logic here, not in `app/`.
- `components/ui/` — the design system (Bouton, Champ, Badge, Tableau,
  Modale…), generic and reusable.
- `components/metier/` — components that bake in BTP/regional business
  rules that a generic library wouldn't have: e.g. `ChampTelephone` **stores**
  E.164 (`+2250700000000`) but **displays** a local format, because the
  WhatsApp deep link the server builds needs the country code; `SelecteurVille`
  follows the company's country, sourced from the server, not user-editable.
  The city (`features/referentiels/villes.ts`, **generated** from the Python
  referential) and phone (`telephone.ts`, hand-written) lists must stay
  in sync — both are closed to the same nine signup countries.
- `components/layout/` — nav, header, breadcrumb, footer.
- `lib/api/` — HTTP client, token storage, error types, simulation layer.
- `lib/auth/` — session clocks, route guards, `SurveillantSession`.
- `types/` — TypeScript types generated from the backend's OpenAPI
  contract; don't hand-edit generated sections.
- `dev/` — dev-only test harness, double-gated (see above).

## React Query conventions (`app/providers.tsx`)

`staleTime: 30s`, `gcTime: 5min`, `refetchOnWindowFocus: false`. Queries never
retry a 4xx (`ErreurApi.estTemporaire` gates retry — permission/business-rule
errors won't resolve by repeating them, and repeating them wastes seconds on
a slow site connection). Mutations never auto-retry — a duplicated write costs
more than a visible failure the user can retry themselves. The `QueryClient`
is created in `useState`, not module scope, so SSR doesn't leak one user's
cache into another's request.

## Path alias

`@/*` → `./*` (see `tsconfig.json`).

## Refonte in progress — read this before writing anything

The codebase is migrating towards `docs/ARCHITECTURE_REUTILISABLE.md`, in
numbered lots (`docs/plan_refont.md`), against the findings of
`docs/DIAGNOSTIC_ARCHITECTURE.md`. **Lot 0 is done, and lot 7 — the removal of
every CSS Module — has landed.** One styling system now, Tailwind; two icon
sets still coexist on purpose (A2 below), and the rules that follow are what
keeps the rest from drifting.

### Decisions already taken — do not "fix" them back

- **A1 — `features/<domaine>/` stays**, against the reference doc's
  `lib/<domaine>/`. This is a **deliberate divergence**: what the doc mandates
  is the *stratification*, not the folder name, and `features/projets` ↔
  `backend/apps/projets/` is an invariant worth more than a rename of 116
  files. The five layers go *inside* each domain folder:
  `types.ts` (domain types, no HTTP shape) · `regles.ts` (pure business rules,
  zero React) · `validations.ts` (zod schemas for writes) · `adaptateur.ts`
  (API ↔ domain mapping, ex-`api.ts`) · `actions.ts` (`"use server"`) ·
  `components/`.
  **`projets`, `tableauDeBord` and `tiers` are migrated** (lot 4, partial);
  the other domains still expose a flat `api.ts` and will follow. Two ESLint
  rules now hold the line: `app/**` and `components/**` cannot import `api`
  / `apiPlateforme` / `appeler` from `@/lib/api` (go through the domain's
  `adaptateur.ts`), nor import a lowercase `snake_case` identifier (that is a
  server payload that escaped the domain layer). A screen's business
  calculations belong in `regles.ts` — the seuil de retard was proof of why:
  it existed twice, with two different values.
- **A2 — lucide-react, by strangulation.** No *new* `@phosphor-icons/react`
  import; the 26 existing files migrate when another lot touches them anyway.
  An ESLint `no-restricted-imports` rule enforces this from lot 2 on.
- **A3 — no dark mode.** An unreachable dark theme is CSS that rots, not a
  feature on hold. This was briefly revised (dark mode scoped to the Tailwind
  screens, toggled by a `.dark` class) and then **reverted at the product
  owner's request** — the result was judged ugly, and half the product could
  not follow it anyway while the CSS Modules screens remain. Everything is
  gone, not disabled: `lib/theme/`, `ToggleTheme`, the blocking theme
  script in the root layout, the `.dark` alias block of `tokens.css` §13, and
  the `@custom-variant dark` declaration in `globals.css`. **That last removal
  is the guard**: with the variant undeclared, a stray `dark:…` fails to
  compile instead of quietly producing a rule no screen can reach. Don't
  reintroduce one without reintroducing the other.
- **A4 — target is the `httpOnly` cookie session** (option B of the plan):
  Django posts the session cookie at login, which turns the route guard into a
  real guard and unlocks server actions and server rendering. Until the backend
  delivers it, `jetons.ts` keeps **both** tokens in `localStorage` (the access
  token stopped living in memory only — see the session section above), and
  lot 5 stays on its fallback variant. Lots 0-4 and 6 are written to pay off
  either way.

### Rules

**Tailwind is the only styling system.** The last `*.module.css` is gone —
all 37 of them, ~3 200 lines, folded into the components they dressed. What
was shared through a stylesheet is now shared through a module of class
constants (`app/(app)/tableau-de-bord/classes.ts` is the one real case: nine
components depended on a single CSS file for their consistency, and that role
had to go somewhere explicit).

Two things that migration surfaced, worth knowing before reading old code:
- **Several `--*` tokens never existed.** `--font-size-*`, `--color-danger-*`,
  `--color-warning-*`, `--color-success-*`, `--transition-rapide`,
  `--color-semantic-*-text` / `-border`: every one of them was read somewhere
  and declared nowhere. With a fallback they silently used an off-palette
  value; without one the whole declaration dropped — two access levels in
  `SelecteurNiveau` rendered with no tone at all. They now go through the
  charte's real tokens, which shifts a few reds and greens by a shade.
- **`styles/tokens.css` §4 still carries the typography scale** as plain
  global classes (`text-h1` … `text-caption`). They are the way to size a
  heading without inventing a value: the charte's sizes are 32/28/24 px, which
  Tailwind's default scale does not carry.

1. **No new `*.module.css`.** Tailwind + shadcn, always.
2. **Preflight is still off** (`app/globals.css` says why, and what the last
   step is). A `<button>` or `<input>` therefore keeps the browser's default
   chrome — say `bg-transparent border-0` explicitly.
3. **No new colour in `style={{}}`** — it goes through a status tone
   (`components/statut/tons.ts`) or a charte utility.
4. **No hardcoded value**: not a colour, not a spacing, not a radius.
   `styles/tokens.css` is the single source; add the token there or don't
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
