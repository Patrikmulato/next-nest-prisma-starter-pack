---
description: Rules for editing backend data files
globs: backend/src/data/**
---

- `geo-car-helpdesk.ts` is **auto-generated** — running `sync:data` will overwrite it completely; it owns `euPlateData`, `cameraGenData`, `coverageYearsData`, `carColorData`, `vehicleTypeData`
- `road-lines.ts` is hand-editable and crawler-appendable; it is not overwritten by sync — safe to edit
- `driving-side.ts` and `geoguessr-countries.ts` are hand-maintained — edit directly
- `country-aliases.ts` maps GeoJSON country names to data keys (e.g. "United States of America" → "United States"); update it whenever a new country's GeoJSON name differs from the key used in other data files
- Allowed road line patterns are defined in `dto/filter-request.dto.ts` (`ROAD_LINE_PATTERNS`) — do not add patterns to `road-lines.ts` that aren't in that list
