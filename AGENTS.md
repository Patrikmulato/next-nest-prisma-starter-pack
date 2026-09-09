<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Before changing Next.js application code, routing, caching, rendering behavior, middleware, metadata, image handling, request APIs, or configuration:

1. Inspect the relevant existing implementation in this repository.
2. Read the applicable guide in `node_modules/next/dist/docs/` before writing any code.
3. Heed deprecation notices and follow repository conventions.
4. Do not introduce legacy Pages Router patterns or deprecated APIs.

<!-- END:nextjs-agent-rules -->

# GeoGuessr Helper — Agent Instructions

## Project Overview

A Next.js web app that helps players identify countries in GeoGuessr by visualizing geographic clues (driving side, road line markings, etc.) on an interactive Leaflet world map with filter toggles. The backend is the source of truth for map data, filtering, and auth — it must remain authoritative.

## Instruction Priority

Apply repository instructions in this order:

1. The current user request.
2. An approved task-specific spec or plan (e.g. under `docs/`).
3. This `AGENTS.md` and `CLAUDE.md`.
4. Directory-local docs, config, and nearby tests (e.g. `backend/CLAUDE.md`, `.claude/rules/`).

If instructions conflict or the required behavior is ambiguous, stop and ask for clarification rather than silently picking an interpretation.

## Requirements

- **Node.js 22+** (`.nvmrc`, `.node-version`, `package.json` engines)
- pnpm 10.10.0+

## Tech Stack

- **Framework:** Next.js 16 (App Router) with TypeScript
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/postcss`)
- **Map:** Leaflet + react-leaflet (loaded client-side via `next/dynamic` with `ssr: false`)
- **Backend:** NestJS 11 API in `backend/`
- **Database:** PostgreSQL via Prisma (`backend/prisma/schema.prisma`)
- **Package manager:** pnpm workspace
- **Path alias:** `@/*` → `./src/*`

## Project Structure

```
src/
  app/              # Next.js App Router pages and layouts
    layout.tsx      # Root layout
    page.tsx        # Main page — full-screen map with filter bar
    globals.css     # Global styles + Leaflet tooltip overrides
  components/       # Reusable React components
    WorldMap.tsx    # Leaflet map component (client-only)
    FilterDropdown.tsx  # Generic filter dropdown (grouped options, smart positioning)
  config/           # App configuration (API base URL, env vars)
  lib/api/          # API client + typed API wrappers
  types/            # Shared TypeScript contracts for API payloads
backend/
  crawlers/         # External guide scraping, consolidation, extraction, and merge scripts
  prisma/           # Prisma schema and migrations
  scripts/          # One-off backend operational scripts
  src/
    modules/        # NestJS feature modules: auth, data, health, saved-filters, users, prisma
    common/         # Shared infra: cache, rate-limit, logger
  # see backend/CLAUDE.md for the full directory breakdown
.claude/
  commands/         # Project slash commands (see below)
  rules/            # Context-aware agent rules loaded by file glob
  settings.json     # Pre-allowed commands + hooks
public/
  countries.geo.json  # World boundaries source read by backend
```

## Claude Commands

Invoke these with `/command-name` in Claude Code:

| Command         | Purpose                                                             |
| --------------- | ------------------------------------------------------------------- |
| `/crawl`        | Run the full 4-stage crawler pipeline                               |
| `/sync-data`    | Sync GeoCarHelpDesk repo and regenerate `geo-car-helpdesk.ts`       |
| `/add-country`  | Guided flow to add a new country across all data files              |
| `/check-filter` | Verify backend DTO and frontend types are in sync for all 7 filters |

## Commands

| Command                                                     | Purpose                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                                                  | Start Next.js dev server                                       |
| `pnpm dev:backend`                                          | Start NestJS backend                                           |
| `pnpm build`                                                | Build frontend                                                 |
| `pnpm build:backend`                                        | Build backend                                                  |
| `pnpm test`                                                 | Run frontend tests                                             |
| `pnpm test:coverage`                                        | Run frontend tests with coverage                               |
| `pnpm --filter geoguessr-helper-backend test`               | Run backend tests                                              |
| `pnpm --filter geoguessr-helper-backend crawl:guides`       | Scrape country guide data                                      |
| `pnpm --filter geoguessr-helper-backend consolidate:guides` | Build consolidated crawler dataset                             |
| `pnpm --filter geoguessr-helper-backend extract:guides`     | Generate structured extracted crawler data                     |
| `pnpm --filter geoguessr-helper-backend merge:crawlers`     | Append missing extracted data into backend data files          |
| `pnpm --filter geoguessr-helper-backend sync:data`          | Regenerate GeoCarHelpDesk data and reapply crawler append step |
| `pnpm --filter geoguessr-helper-backend sync:carmeta`       | Fetch carmeta GitHub data and regenerate `car-meta-coords.ts`  |

## CI/CD

The project uses GitHub Actions for continuous integration. The CI workflow (`.github/workflows/ci.yml`) runs on pull requests and pushes to main, performing:

- Dependency installation
- Frontend linting
- TypeScript type checking (frontend and backend)
- Backend build and testing
- Frontend testing with coverage reporting
- Frontend build
- Coverage upload to Codecov

All checks must pass for auto-merge to be enabled.

## Git Hooks (Husky)

The project uses Husky to enforce code quality, formatting, and testing at key git stages:

### Pre-Commit Hook

Runs on every commit attempt:

1. **TypeScript type checking** on `.ts`/`.tsx` files (`tsc --noEmit`)
2. **ESLint** auto-fixes style issues on changed code
3. **Prettier** formats code and JSON/CSS/Markdown files
4. **Jest** runs related tests in `--bail` mode (stops on first failure)

If any check fails, fix the issues and re-stage before retrying the commit.

### Commit Message Hook

Validates commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

Example: feat(filters): add new driving side filter
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `revert`

### Pre-Push Hook

Runs before pushing to remote:

1. Type checking for frontend and backend
2. Full test suite (not just related tests)
3. Frontend build validation

Prevents pushing code that doesn't compile or has failing tests.

### Bypass Hooks (Not Recommended)

- Commit only: `git commit --no-verify`
- Push only: `git push --no-verify`

## Change Discipline

- Inspect existing code, nearby tests, and relevant docs before changing an area; reuse established patterns for DTOs, validation, error handling, logging, caching, API responses, auth, and config.
- Keep diffs minimal and focused on the requested task. Do not refactor unrelated code while implementing a feature or fix.
- Preserve public API and UI behavior unless a change is explicitly required.
- Do not add, remove, or upgrade dependencies, or change lockfiles, env files, build settings, CI/CD, or deployment config, without explicit approval.

## NestJS DTO Validation

This build cannot rely on reflected `@Body()` metatype inference for the global `ValidationPipe` (see the `// The global ValidationPipe can't infer the @Body() metatype in this build` comments in `auth.controller.ts`, `data.controller.ts`, `saved-filters.controller.ts`, `users.controller.ts`). Every controller that validates a request DTO must instantiate a local `ValidationPipe` and pass the DTO class explicitly (`new ValidationPipe({ ... })` with the expected type) rather than assuming the global pipe infers it. Reuse this existing pattern instead of inventing a new one.

## Security, Database, and External Side Effects

- Never expose, print, commit, or log secrets, credentials, tokens, JWTs, cookies, API keys, or full request headers. Never place server-only secrets in browser code or `NEXT_PUBLIC_*` env vars.
- Preserve authorization, ownership checks, input validation, and rate limiting when modifying protected functionality — do not weaken a security check to make a feature work.
- Ask before running migrations, seeders, or destructive database commands, and before any command that contacts non-local services or mutates external infrastructure. Never run production migrations/deletes/deployments without explicit approval.

## Validation and Completion Standard

- Use existing package scripts, CI config, and nearby tests as the source of truth for validation commands; run the narrowest relevant check first, then broader checks (lint, typecheck, tests, build) when the change warrants it.
- Do not state that a test, build, lint, or manual check passed unless it was actually run and the result is known. If validation can't be run, say what was skipped and why.

## Key Conventions

1. **Backend-owned data/filtering** — API is source of truth for map data and filter results:

- `GET /api/data/geojson`
- `GET /api/data/map`
- `POST /api/data/filter`

2. **Validation** — Filter payload validation is defined in `backend/src/modules/data/dto/filter-request.dto.ts`.
3. **Tooltip ownership** — Tooltip HTML is composed server-side and delivered in `tooltipHtmlByCountry`.
4. **Frontend responsibilities** — UI state, map rendering, and API orchestration only.
5. **Styling** — Use Tailwind utility classes. Dark theme is the default. Custom CSS goes in `globals.css` only when Tailwind can't cover it.
6. **Crawler outputs are generated artifacts** — Files under `backend/crawlers/data/` are local/generated and should not be committed.
7. **GeoCarHelpDesk sync behavior** — `backend/src/data/geo-car-helpdesk.ts` is regenerated by `sync:data`; crawler-derived append-only data is reapplied automatically after every sync.
8. **Carmeta sync behavior** — `backend/src/data/car-meta-coords.ts` is regenerated by `sync:carmeta`; it holds per-country car color coordinate samples (≤400 points, colorIdx 1–8) sourced from the carmeta GitHub repo. Do not hand-edit.
9. **Crawler source config** — `crawl:guides` reads `GUIDE_SOURCE_BASE_URL` and optional `GUIDE_SOURCE_SITEMAP_URL`, `GUIDE_CRAWL_LIMIT`, and `GUIDE_CRAWL_DELAY_MS` from env.

## Do NOT

- Bypass backend for map/filter data (frontend should call API wrappers in `src/lib/api/map-data.ts`)
- Use Leaflet on the server — always gate behind `"use client"` and dynamic import
- Install map tile providers that require API keys without asking first
- Commit generated crawler output from `backend/crawlers/data/`
- Hand-edit `backend/src/data/geo-car-helpdesk.ts` without considering that `sync:data` will regenerate it
- Hand-edit `backend/src/data/car-meta-coords.ts` — `sync:carmeta` will regenerate it
- Commit, push, create branches, amend history, rebase, reset, stash, or discard changes unless explicitly asked
- Create, apply, or modify database migrations without explicit approval
