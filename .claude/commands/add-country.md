# /add-country — Add a new country to the dataset

Guided flow to correctly add a new country across all required data files. Missing any file will cause the country to be missing or broken on the map.

## Steps

1. **Ask for the country name** if not provided as an argument.

2. **Check `backend/src/data/geoguessr-countries.ts`**
   Does the country appear in GeoGuessr? If yes, add it to the set. If no, it will appear greyed out on the map — confirm with the user before proceeding.

3. **Check GeoJSON name**
   Look up the country's feature name in `public/countries.geo.json` (search `properties.name`).
   If it differs from the data key name, add a mapping to `backend/src/data/country-aliases.ts`.

4. **Add driving side** → `backend/src/data/driving-side.ts`
   Add `"CountryName": "left"` or `"right"`.

5. **Add road lines** → `backend/src/data/road-lines.ts`
   Add `"CountryName": [/* RoadLinePattern[] */]`.
   Valid patterns are defined in `backend/src/modules/data/dto/filter-request.dto.ts` (`ROAD_LINE_PATTERNS`).

6. **Check `geo-car-helpdesk.ts`** for EU plate, camera gen, coverage years, car color, vehicle type.
   This file is auto-generated — if the country is missing, note it for the user. They can add it via the crawler pipeline or wait for the next `sync:data`.

7. **Run backend tests** to confirm nothing is broken:
   ```
   pnpm --filter geoguessr-helper-backend test
   ```

## After completion

Summarise which files were updated and which data points are still missing (e.g. not yet in `geo-car-helpdesk.ts`).
