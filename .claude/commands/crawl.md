# /crawl — Run the full crawler pipeline

Run the 4-stage crawler pipeline in sequence. Stop and report if any stage fails.

## Steps

1. **Stage 1-2: Scrape guides**

   ```
   pnpm --filter geoguessr-helper-backend crawl:guides
   ```

   Puppeteer scrapes the guide site sitemap and saves per-country JSONs to `backend/crawlers/data/`.
   Requires `GUIDE_SOURCE_BASE_URL` env var. Ask the user if it's not set.

2. **Stage 3: Consolidate**

   ```
   pnpm --filter geoguessr-helper-backend consolidate:guides
   ```

   Validates and merges per-country files into `countries_master.json`.

3. **Stage 4a: Extract**

   ```
   pnpm --filter geoguessr-helper-backend extract:guides
   ```

   NLP/regex extraction of road lines, camera gens, coverage years, car colors, vehicle types.
   Produces `crawler-extraction-review.json` with confidence scores.

4. **Stage 4b: Merge**
   ```
   pnpm --filter geoguessr-helper-backend merge:crawlers
   ```
   Append-only merge into `backend/src/data/`. Skips countries already present.

## After completion

- Report how many countries were processed and how many new entries were merged into each data file.
- Remind the user that `backend/crawlers/data/` outputs must not be committed.
- If any entries were flagged as low-confidence in `crawler-extraction-review.json`, surface them for manual review.
