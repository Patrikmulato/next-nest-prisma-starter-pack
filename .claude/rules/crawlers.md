---
description: Rules for working in the crawler pipeline
globs: backend/crawlers/**
---

- Pipeline runs in 4 stages: `crawl:guides` → `consolidate:guides` → `extract:guides` → `merge:crawlers`
- `crawlers/data/` contains generated artifacts — never commit these files
- The merge step (`append-crawler-data-to-backend-data.ts`) is **append-only** — it skips countries already present in `src/data/`; re-running is safe
- Crawler source is configured via env vars: `GUIDE_SOURCE_BASE_URL` (required), `GUIDE_SOURCE_SITEMAP_URL`, `GUIDE_CRAWL_LIMIT`, `GUIDE_CRAWL_DELAY_MS`
- Extraction confidence thresholds: entries below ~0.45–0.6 are flagged in `crawler-extraction-review.json` for manual review before merging
- Country name normalization (e.g. "Czechia" → "Czech Republic") is handled in `append-crawler-data-to-backend-data.ts` via `COUNTRY_MAP` — update it if new scraped names don't match data file keys
- Valid values for merge: road line patterns from `ROAD_LINE_ALLOWED`, car colors `black|blue|gray|red|striped|white`, camera gens 1–4, coverage years 2007–2035, vehicle types `car|suv|truck`
