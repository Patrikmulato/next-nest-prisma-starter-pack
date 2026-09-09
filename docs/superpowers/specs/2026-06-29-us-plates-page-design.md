# US Plates Page — Design Spec

**Date:** 2026-06-29  
**Branch:** feat/us-car-plates  
**Status:** Approved

---

## Overview

A new page at `/us-plates` that lets GeoGuessr players browse US license plates by state. A wide left panel shows plate images with a color filter; a Leaflet map on the right shows all 50 US states with name labels. The two panels are bidirectionally linked — clicking a plate highlights its state on the map, and clicking a state on the map shows its plates in the left panel.

---

## Data

### Source

Scraped once from `https://denes0216.github.io/GeoCarHelpDesk/us-plates-data.js` and committed as a static TypeScript file. No ongoing sync needed.

### Static data file: `src/data/us-plates.ts`

```ts
export interface USPlate {
  state: string; // e.g. "California"
  difficulty: 'easy' | 'somewhat' | 'harder';
  file: string; // e.g. "plate_r00_c00.png"
  colors: string[]; // e.g. ["white", "blue"]
  label: string; // e.g. "Golden State"
}

export const US_PLATES: USPlate[] = [/* 88 entries */];

export const PLATES_IMAGE_BASE = '/us-plates/';
```

**88 plates total across 50 states** (plus Washington DC). Colors: white, blue, green, yellow, red.

### Plate images: `public/us-plates/`

All 88 plate images downloaded from `https://denes0216.github.io/GeoCarHelpDesk/data/us-plates/` and committed to `public/us-plates/`. Served locally at `/us-plates/{file}`. A one-time download script handles this during implementation.

### US States GeoJSON: `public/us-states.geo.json`

Standard public-domain US states GeoJSON (e.g. from PublicaMundi/MappingAPI). Downloaded once and committed.

**Name mapping:** GeoJSON `properties.name` values may differ from `US_PLATES` state names. A small mapping constant in `USMap.tsx` handles known mismatches (e.g. GeoJSON `"District of Columbia"` → plate data `"Washington DC"`). Verified at implementation time by diffing GeoJSON names against plate data state names.

---

## Files Changed / Created

| File                         | Action                                   |
| ---------------------------- | ---------------------------------------- |
| `src/data/us-plates.ts`      | New — static scraped plate data          |
| `public/us-states.geo.json`  | New — US states GeoJSON                  |
| `public/us-plates/*.png`     | New — 88 plate images downloaded locally |
| `src/app/us-plates/page.tsx` | New — page component                     |
| `src/components/USMap.tsx`   | New — Leaflet US states map              |
| `src/app/layout.tsx`         | Modified — add nav link                  |

No backend changes.

---

## Components

### `USMap.tsx`

Client-only Leaflet map (`"use client"`, loaded via `next/dynamic` with `ssr: false`).

**Props:**

```ts
interface USMapProps {
  selectedState: string | null;
  highlightedStates: Set<string>; // states with plates matching current color filter
  onStateClick: (state: string) => void;
}
```

**Behaviour:**

- Dark CartoDB tile layer (same as `WorldMap.tsx`)
- Loads GeoJSON from `/us-states.geo.json`
- Fitted to continental US bounds on mount
- State name labels rendered as permanent Leaflet tooltips (centered on each feature)
- Fill colours:
  - Selected state: blue (`#3b82f6`, opacity 0.7)
  - Highlighted (has matching plates): lighter slate (`#314252`, opacity 0.85)
  - Dimmed (no matching plates under current filter): dark (`#1e2530`, opacity 0.5)
  - No filter active (all plates shown): all states use the default fill
- Hover: white border, weight 2
- Clicking a state calls `onStateClick(stateName)`; clicking the already-selected state calls `onStateClick` with same value (parent toggles it off)

### `src/app/us-plates/page.tsx`

`"use client"` component. Full-screen, two-panel layout matching the overall app shell.

**State:**

```ts
const [selectedState, setSelectedState] = useState<string | null>(null);
const [colorFilter, setColorFilter] = useState<string>('all');
```

**Derived values (via `useMemo`):**

- `filteredPlates` — `US_PLATES` filtered by `colorFilter` (and by `selectedState` if set)
- `highlightedStates` — `Set<string>` of states that have at least one plate matching `colorFilter`

**Left panel (~290px, fixed width):**

- Header: "US License Plates"
- Color pill row: All / White / Blue / Green / Yellow / Red
  - Active pill: `bg-blue-600 text-white`
  - Inactive: `bg-[#2a3340] text-slate-400`
- State + count label: `"California · 3 plates"` or `"All states · 88 plates"`
- Scrollable plate grid (3 columns):
  - Each cell: `<img>` with `src={PLATES_IMAGE_BASE + plate.file}` and `alt={plate.label}`
  - Selected plate (state matches `selectedState`): blue border ring
  - Clicking a plate: sets `selectedState` to `plate.state`
  - Plate label shown on hover as native `title` attribute

**Right panel (flex-1):**

- `USMap` loaded via `next/dynamic` with `ssr: false`
- Receives `selectedState`, `highlightedStates`, `onStateClick`
- `onStateClick`: toggles selection — if same state clicked, sets to `null`; otherwise sets to that state

---

## Interaction Model

| Action                        | Result                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| Click state on map            | `selectedState` = state, left panel shows that state's plates (filtered by color), scrolls to top |
| Click already-selected state  | `selectedState` = null, left panel shows all plates                                               |
| Click plate image             | `selectedState` = plate's state, map highlights that state                                        |
| Click color pill              | `colorFilter` updates, `highlightedStates` recalculates, plate list re-filters                    |
| Color filter + state selected | Shows only that state's plates matching the color                                                 |

---

## Navigation

Add a "US Plates" link to the existing navbar in `src/app/layout.tsx`, pointing to `/us-plates`. Matches existing nav link style.

---

## What's Explicitly Out of Scope

- Difficulty filter (intentionally excluded per design decisions)
- Backend API endpoint for plate data (static, client-side only)
- Mobile / responsive layout (app is desktop-focused)
