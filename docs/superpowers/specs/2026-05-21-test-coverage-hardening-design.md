# Test Coverage Hardening

**Date:** 2026-05-21
**Goal:** Harden the application against silent Renovate regressions by adding meaningful behavior tests across all three layers — frontend components, API client, and backend filter logic.

---

## Context

Current test coverage is thin:

- 2 no-op frontend tests (`page.test.tsx`) — only check that the page doesn't crash
- 4 backend service tests — cover main filter combinations but not edge cases
- 4 backend e2e tests — cover DTO validation for `POST /api/data/filter` only

Renovate merges dependency updates automatically. The risk is a silent behavioral regression passing CI because tests don't exercise the right behavior. This spec adds ~20 new tests across 5 areas to catch the most likely regressions.

---

## Section 1 — Frontend: `ApiClient` unit tests

**File:** `src/lib/api/__tests__/client.test.ts`

Uses a mocked global `fetch`. Five test cases:

1. URL construction with query params — `buildUrl` appends params correctly to the base URL
2. URL construction without params — no trailing `?` or extra characters
3. Non-2xx response throws `ApiError` with the correct `.status` and `.message` from the response body
4. Response body that fails JSON parsing falls back to `res.statusText` as the error message
5. POST request: body is JSON-serialized and `Content-Type: application/json` header is present

**Why:** The `ApiClient` is the single HTTP boundary for the entire frontend. A Node.js version bump or fetch API change could silently break error handling or request serialization — these tests will catch it.

---

## Section 2 — Frontend: `FilterDropdown` component tests

**File:** `src/components/__tests__/FilterDropdown.test.tsx`

Uses `@testing-library/react`. Six test cases:

1. Renders `placeholder` text when no option matches the current `value`
2. Shows the selected option's label in the trigger button when `value` matches an option
3. Clicking the trigger opens the panel (option buttons become visible in the DOM)
4. Selecting an option calls `onChange` with the correct value and closes the panel
5. Clicking outside the open panel closes it
6. Smart positioning: when `getBoundingClientRect` is mocked to return near-bottom coords (`bottom: 700` with `window.innerHeight: 768`), the panel renders above the trigger (`top < rect.top`) rather than below

**Implementation note:** Tests 1–5 work without mocking `getBoundingClientRect` because jsdom returns all zeros, which resolve to a valid above-fold position. Test 6 uses `jest.spyOn(Element.prototype, 'getBoundingClientRect')`.

---

## Section 3 — Frontend: `page.tsx` data flow tests

**File:** `src/app/__tests__/page.test.tsx` (replace existing 2 no-op tests)

`WorldMap` is mocked as a no-op `<div>` via `jest.mock` (Leaflet cannot run in jsdom). Five test cases:

1. On mount, `fetchGeoJson` and `fetchMapData` are each called exactly once
2. Simulating a filter change via user interaction triggers `fetchFilteredCountries` with the updated filter value
3. When `fetchMapData` rejects, an error message is rendered in the DOM
4. When `fetchGeoJson` rejects, an error message is rendered in the DOM
5. When `fetchFilteredCountries` returns a non-empty `countries` array, the component does not crash

**Why:** Verifies the data-fetch orchestration in `page.tsx` — the main integration point between the frontend and the backend API.

---

## Section 4 — Backend: service edge cases

**File:** `backend/src/modules/data/data.service.test.ts` (expand existing 4 tests)

Five additional test cases using Node.js native `node:test`:

1. `lineFilter` with a specific pattern returns only countries that have that pattern; excludes countries that don't
2. `coverageYearFilter` with a specific year returns only countries whose coverage range includes that year
3. A country with no entry in `cameraGenData` is excluded when `cameraGenFilter` is a specific gen (not `'all'`) — verifies missing-data-equals-excluded contract
4. A country with no entry in `euPlateData` is excluded when `euPlateFilter` is `'yes'`
5. Combined `sideFilter: 'left'` + `euPlateFilter: 'yes'` returns the intersection of both filters

**Why:** These test the exact contracts that could silently change if a data file or filter logic is updated by Renovate or a merge.

---

## Section 5 — Backend: e2e GET endpoints

**File:** `backend/src/modules/data/data.controller.e2e.test.ts` (expand existing 4 tests)

Four additional test cases:

1. `GET /api/data/geojson` returns 200 with `type: 'FeatureCollection'` and a `features` array
2. `GET /api/data/map` returns 200 with all expected top-level keys: `aliases`, `geoguessrCountries`, `drivingSideData`, `roadLinesData`, `euPlateData`, `cameraGenData`, `coverageYearsData`, `carColorData`, `vehicleTypeData`, `tooltipHtmlByCountry`
3. `POST /api/data/filter` with a missing required field (omit `sideFilter`) returns 400
4. `POST /api/data/filter` called twice with the same payload returns identical `countries` arrays (cache correctness)

---

## Out of Scope

- `WorldMap.tsx` unit tests — Leaflet is jsdom-incompatible; the component is a thin rendering wrapper with no logic worth testing in isolation
- Crawler pipeline tests — scripts, not application code
- Snapshot tests — brittle, high maintenance, low Renovate-regression signal (TypeScript type-checking at CI already covers type drift)

---

## Success Criteria

- All new tests run in CI without additional infrastructure
- Each test fails if the behavior it covers regresses
- No mocks that could diverge from real behavior (e.g. no mocked `DataService` in backend tests)
- Total new tests: ~20 across the 5 files listed above
