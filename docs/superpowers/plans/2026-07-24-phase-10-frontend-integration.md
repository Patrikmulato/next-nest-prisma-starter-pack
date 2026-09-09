# GeoHelper Phase 10 — Frontend Integration & Launch Polish

Source: planned collaboratively (2026-07-24). Companion to `2026-07-22-backend-roadmap-v2.md`.

## Goal

Surface the already-deployed backend capabilities (auth, saved filters, users/RBAC) in the Next.js frontend, add API docs, and finalize launch readiness. Deliverable: **launch-ready** full-stack app.

## Current state (verified)

- Backend deployed on Vercel serverless, working.
  - Public: `GET /api/data/geojson`, `GET /api/data/map`, `POST /api/data/filter`, `GET /api/health`
  - Auth: `POST /api/auth/register`, `/login`, `/refresh`, `/logout`; `GET /api/auth/me` (JwtAuthGuard)
  - Saved filters: `POST/GET/PUT/DELETE /api/saved-filters`, `GET /api/saved-filters/:id`, `GET /api/saved-filters/public` (paginated, rate-limited 60/min)
  - Users (ADMIN RBAC): `GET /api/users`, `GET /api/users/:id`, `POST /api/users`
  - Rate limiting + versioned caching already live.
- Frontend: Next.js 16. `ApiClient` (`src/lib/api/client.ts`) handles GET/POST and unwraps `{ success, data }`. No auth header, no refresh, no token storage.
- Frontend pages: `/` (world map, 7 filters as local `useState`), `/us-plates`, `/useful-maps`. Navbar: 3 static tabs, no auth.
- Auth returns tokens in JSON body (`AuthResponseDto`: `accessToken`, `refreshToken`, `user { id, email, role }`). CORS `credentials: true`, `*.vercel.app` allowed.

## Gap

The frontend uses none of the auth / saved-filters / users capabilities. Phase 10 wires them into the UI plus docs and launch polish.

## Decisions (locked)

- **Token storage:** in-memory access token + `localStorage` refresh token.
- **Auth UI:** dedicated `/login` and `/register` routes. **No navbar buttons/links** to them (discoverable by URL only).
- **Login indicator:** green status icon next to the "GeoGuessr Helper" title when authenticated; tooltip shows the role. Clicking the icon opens a popover containing the role + **Logout**.
- **Scope:** personal saved filters + public gallery + Swagger docs + ADMIN users management UI.
- **Dashboard:** `/dashboard` route, ADMIN-only, **no navbar tab** (URL-only, like login/register).
  - Unauthenticated → redirect to `/login`.
  - Logged-in non-admin → **403 "not authorized" page** (not a redirect).
  - Content: **read-only users table** via `GET /api/users`.
- **Swagger:** included at `/api/docs`.

## Phases

### Phase A — Auth client foundation

- Enhance `src/lib/api/client.ts`: inject `Authorization` header; on `401`, call `/api/auth/refresh` once and retry the original request.
- New `AuthProvider`/context: in-memory access token + `localStorage` refresh token; bootstrap on load (refresh → `GET /api/auth/me`); expose `login`/`register`/`logout`/`user`/`role`.
- New `src/lib/api/auth.ts` + `src/types/auth.ts`.

### Phase B — Auth UI (route-only)

- `/login` and `/register` routes — no navbar links; redirect after success (→ `/`, or `/dashboard` if ADMIN).
- `src/components/Navbar.tsx`: green status dot next to the title when authenticated; tooltip = role; click → popover with role + Logout.
- Error and `429` rate-limit messaging on auth forms.

### Phase C — Saved filters

- New `src/lib/api/saved-filters.ts` + `src/types/saved-filters.ts`.
- Save current 7-filter state from `src/app/page.tsx` → `filters` JSON.
- "My filters" panel: list / apply / rename / delete.
- Public gallery (`/filters` route): paginated, apply, view counts.
- Apply mapping: `SavedFilter.filters` JSON → `page.tsx` state setters.

### Phase D — Admin dashboard

- `/dashboard` route, ADMIN-only (**no navbar tab**; URL-only).
- Client guard via AuthContext: unauthenticated → `/login`; logged-in non-admin → 403 page.
- Read-only users table via `GET /api/users`.

### Phase E — Backend docs + polish

- Swagger/OpenAPI at `/api/docs` (`@nestjs/swagger`).
- CORS + security-header review in `backend/src/app-setup.ts`.

### Phase F — Launch readiness

- Frontend `NEXT_PUBLIC_API_BASE_URL` → prod backend in `src/config/index.ts`.
- Smoke-verify full flows against prod; pre-prod checklist.

## Key files

- `src/lib/api/client.ts` — auth header + refresh-retry
- `src/config/index.ts` — env
- `src/components/Navbar.tsx` — green status indicator + role tooltip + Logout popover
- `src/app/layout.tsx` — wrap `AuthProvider`
- `src/app/page.tsx` — save/apply filter integration
- New: `AuthProvider`, `/login`, `/register`, `/dashboard`, `/filters`, My Filters panel, `src/lib/api/auth.ts`, `src/lib/api/saved-filters.ts`, `src/types/auth.ts`, `src/types/saved-filters.ts`
- Backend: `main.ts` / `swagger.config.ts` (Swagger)

## Verification

- Unit: `ApiClient` refresh-retry; `AuthContext` bootstrap; admin guard/403; filter-apply mapping.
- Manual/e2e: register → login → save → reload → apply → delete; admin sees `/dashboard`, non-admin gets 403.
- `pnpm test`, `pnpm build`, `pnpm --filter geoguessr-helper-backend test`.

## Checklist

- [ ] Phase A — Auth client foundation
- [ ] Phase B — Auth UI (route-only)
- [ ] Phase C — Saved filters
- [ ] Phase D — Admin dashboard
- [ ] Phase E — Backend docs + polish
- [ ] Phase F — Launch readiness
