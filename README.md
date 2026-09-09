# GeoGuessr Helper

GeoGuessr helper app with a Next.js frontend and a NestJS backend.

## Prerequisites

- **Node.js 22 or higher** (see `.nvmrc` or `.node-version`)
- pnpm 10.10.0+ (specified in `package.json` packageManager)

## Stack

- Frontend: Next.js 16 (App Router), TypeScript, Tailwind v4, Leaflet
- Backend: NestJS 11 (`backend/`)
- Crawlers: Node.js + Puppeteer scripts in `backend/crawlers/`
- Package manager: pnpm workspace

## Data Ownership

- Backend is the source of truth for map and filter data.
- Frontend does not use `src/data` runtime datasets.
- API endpoints:
  - `GET /api/data/geojson`
  - `GET /api/data/map`
  - `POST /api/data/filter`

## Run Locally

From repository root:

```bash
pnpm install
pnpm dev
pnpm dev:backend
```

Frontend runs on `http://localhost:3000`.
Backend runs on `http://localhost:3001`.

## Data Pipelines

### GeoCarHelpDesk sync

```bash
pnpm --filter geoguessr-helper-backend sync:data
```

This command:

- regenerates `backend/src/data/geo-car-helpdesk.ts` from `GeoCarHelpDesk`
- reapplies the append-only crawler merge automatically after sync

### Guide crawler workflow

```bash
pnpm --filter geoguessr-helper-backend crawl:guides
pnpm --filter geoguessr-helper-backend consolidate:guides
pnpm --filter geoguessr-helper-backend extract:guides
pnpm --filter geoguessr-helper-backend merge:crawlers
```

Purpose:

- `crawl:guides` scrapes per-country guide data from the configured source
- `consolidate:guides` builds a single master dataset and summary files
- `extract:guides` generates structured TypeScript-style extracted data
- `merge:crawlers` appends only missing entries into backend data files without overwriting existing keys

Notes:

- Crawler scripts are committed in `backend/crawlers/`
- Generated crawler output in `backend/crawlers/data/` is local-only and should not be committed

Optional crawler env in `.env.local`:

```bash
GUIDE_SOURCE_BASE_URL=
GUIDE_SOURCE_SITEMAP_URL=
GUIDE_CRAWL_LIMIT=
GUIDE_CRAWL_DELAY_MS=
```

- `GUIDE_SOURCE_BASE_URL` is required when running `crawl:guides`
- `GUIDE_SOURCE_SITEMAP_URL` defaults to `${GUIDE_SOURCE_BASE_URL}/sitemap.xml`

## Build

```bash
pnpm build
pnpm build:backend
```

## Test Backend

```bash
pnpm --filter geoguessr-helper-backend test
```

Includes:

- Filter semantics tests
- Validation e2e tests for `/api/data/filter`

## Important Rules

- Backend remains the source of truth for runtime map/filter data
- Do not hand-edit `backend/src/data/geo-car-helpdesk.ts` without considering that `sync:data` will regenerate it
- Crawler merge is append-only and does not overwrite existing dataset entries
- Use exact package versions in `package.json`; do not use caret ranges like `^` for dependencies or devDependencies
