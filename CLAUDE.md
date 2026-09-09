@AGENTS.md
@backend/CLAUDE.md

## Quick Reference

**Required:** Node.js 22+ (see `.nvmrc`, `.node-version`, or `package.json` engines field)

**Sync data manually when needed:** Run `pnpm sync:data:pull` to pull the sibling `GeoCarHelpDesk` repo and regenerate backend data. Dev scripts no longer run this automatically.

- Next.js 16 App Router + TypeScript + Tailwind v4
- Leaflet map loaded client-side only (`next/dynamic`, `ssr: false`)
- Key frontend components: `WorldMap.tsx` (map), `FilterDropdown.tsx` (reusable filter UI)
- NestJS backend in `backend/` is source of truth for map/filter data — see `backend/CLAUDE.md` for full backend details
- API routes: `GET /api/data/geojson`, `GET /api/data/map`, `POST /api/data/filter`, `GET /api/data/car-meta`
- Build frontend: `pnpm build` | Dev frontend: `pnpm dev`
- Build backend: `pnpm build:backend` | Dev backend: `pnpm dev:backend`
- Frontend tests: `pnpm test` | Frontend tests with coverage: `pnpm test:coverage`
- Frontend test coverage is minimal (2 tests in `src/app/__tests__/page.test.tsx`) — new features should add tests
- Backend tests: `pnpm --filter geoguessr-helper-backend test`
- **Pre-commit:** Type checking → ESLint → Prettier → Jest tests
- **Commit messages:** Must follow Conventional Commits (e.g., `feat(scope): description`)
- **Pre-push:** Full type checking + all tests + frontend build validation
