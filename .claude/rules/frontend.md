---
description: Frontend rules for src/** files
globs: src/**
---

- All map-related code must use `next/dynamic` with `ssr: false` — Leaflet cannot run on the server
- Never fetch map/filter data directly — always go through the typed wrappers in `src/lib/api/map-data.ts`
- Filter state lives in `src/app/page.tsx`; the backend owns filtering logic via `POST /api/data/filter`
- Tooltip HTML is server-rendered and delivered in `MapDataResponse.tooltipHtmlByCountry` — do not build tooltip HTML on the frontend
- Use Tailwind utility classes for styling; custom CSS goes in `src/app/globals.css` only when Tailwind can't cover it
- Dark theme is the default
- Frontend test coverage is minimal (`src/app/__tests__/page.test.tsx`, 2 tests) — new features should include tests
- If adding a new filter type, update `src/types/map-data.ts` and the backend DTO together
