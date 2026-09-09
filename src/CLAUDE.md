# Frontend — Quick Reference

Next.js 16 App Router + TypeScript + Tailwind v4. All map/filter data comes from the NestJS backend.

## Key Files

| File                            | Role                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `app/page.tsx`                  | Main page — owns all 7 filter states, fetches data, computes color/tooltip callbacks |
| `components/WorldMap.tsx`       | Leaflet map (client-only) — renders GeoJSON layer with color + tooltip props         |
| `components/FilterDropdown.tsx` | Generic dropdown with grouped options and smart viewport positioning                 |
| `lib/api/map-data.ts`           | Typed API wrappers — the only place that calls the backend                           |
| `lib/api/client.ts`             | Generic `ApiClient` class (GET/POST, error handling, AbortSignal)                    |
| `types/map-data.ts`             | Shared TypeScript contracts for all API payloads                                     |
| `config/index.ts`               | `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:3001`)                     |
| `app/globals.css`               | Global styles + Leaflet overrides — custom CSS goes here only                        |

## Rules

- Leaflet **must** be loaded via `next/dynamic` with `ssr: false` — it cannot run on the server
- Always fetch map/filter data through `src/lib/api/map-data.ts` — never call the API directly
- Tooltip HTML is built server-side and delivered in `MapDataResponse.tooltipHtmlByCountry` — do not construct it on the frontend
- If adding a new filter type or value, update `src/types/map-data.ts` **and** `backend/src/modules/data/dto/filter-request.dto.ts` together
- Styling: Tailwind classes first; `globals.css` only when Tailwind can't cover it
- Never use `!important` in `globals.css` — increase selector specificity instead (e.g. `.leaflet-tooltip.my-class` beats `.leaflet-tooltip`)
- Dark theme is the default

## Data Flow

```
Backend /api/data/map   →  mapData (aliases, driving side, road lines, tooltips, …)
Backend /api/data/geojson →  geojson (GeoJSON FeatureCollection)
Backend /api/data/filter  →  filteredCountries (string[])
         ↓
page.tsx: computes getColor() + getTooltip() callbacks
         ↓
WorldMap.tsx: renders GeoJSON layer using those callbacks
```

## Color Priority (getColor in page.tsx)

1. Line pattern color (if `lineFilter` is active)
2. Driving side color (left = blue `#3b82f6`, right = red `#ef4444`)
3. Not in GeoGuessr → `#111827` (greyed)
4. Filtered out → `#1f2937` (dark), opacity 0.3
