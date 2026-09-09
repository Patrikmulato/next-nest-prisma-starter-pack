# /check-filter — Verify filter contract is in sync

Check that the backend DTO and frontend types agree on all 7 filters. A mismatch causes silent failures (invalid requests rejected with 400, or frontend showing options the backend won't accept).

## Steps

1. **Read the backend DTO**
   File: `backend/src/modules/data/dto/filter-request.dto.ts`
   Extract all allowed values for each filter field.

2. **Read the frontend types**
   File: `src/types/map-data.ts`
   Extract the `FilterRequest` type and all filter field types.

3. **Compare field by field**

   | Filter        | DTO field            | Frontend field       |
   | ------------- | -------------------- | -------------------- |
   | Driving side  | `sideFilter`         | `sideFilter`         |
   | Road lines    | `lineFilter`         | `lineFilter`         |
   | EU plate      | `euPlateFilter`      | `euPlateFilter`      |
   | Camera gen    | `cameraGenFilter`    | `cameraGenFilter`    |
   | Coverage year | `coverageYearFilter` | `coverageYearFilter` |
   | Car color     | `carColorFilter`     | `carColorFilter`     |
   | Vehicle type  | `vehicleTypeFilter`  | `vehicleTypeFilter`  |

4. **Report any mismatches** — values present in one but not the other, or type pattern differences (e.g. DTO uses regex `\d{4}` but frontend uses `string`).

5. **Run TypeScript type check** to catch compile-time issues:
   ```
   pnpm typecheck
   pnpm --filter geoguessr-helper-backend build
   ```

## Output

A clear pass/fail per filter. If any mismatch is found, show exactly what differs and which file needs updating.
