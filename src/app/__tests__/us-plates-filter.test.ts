import { US_PLATES } from '@/data/us-plates';
import { filterPlates, getHighlightedStates } from '../us-plates/filter';
import type { USPlate } from '@/data/us-plates';

const VALID_COLORS = new Set(['white', 'blue', 'green', 'yellow', 'red']);
const VALID_DIFFICULTIES = new Set(['easy', 'somewhat', 'harder']);

describe('US_PLATES data shape', () => {
  it('contains 88 entries', () => {
    expect(US_PLATES.length).toBe(88);
  });

  it('every entry has a non-empty state name', () => {
    for (const plate of US_PLATES) {
      expect(typeof plate.state).toBe('string');
      expect(plate.state.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid difficulty', () => {
    for (const plate of US_PLATES) {
      expect(VALID_DIFFICULTIES.has(plate.difficulty)).toBe(true);
    }
  });

  it('every entry has at least one valid color', () => {
    for (const plate of US_PLATES) {
      expect(Array.isArray(plate.colors)).toBe(true);
      expect(plate.colors.length).toBeGreaterThan(0);
      for (const color of plate.colors) {
        expect(VALID_COLORS.has(color)).toBe(true);
      }
    }
  });

  it('every entry has a non-empty file name', () => {
    for (const plate of US_PLATES) {
      expect(plate.file).toMatch(/^plate_(?:r\d+|last)_c\d+\.png$/);
    }
  });
});

const PLATES: USPlate[] = [
  {
    state: 'California',
    difficulty: 'harder',
    file: 'a.png',
    colors: ['white', 'blue'],
    label: 'A',
  },
  { state: 'California', difficulty: 'harder', file: 'b.png', colors: ['red'], label: 'B' },
  { state: 'Texas', difficulty: 'somewhat', file: 'c.png', colors: ['white'], label: 'C' },
  { state: 'Alaska', difficulty: 'easy', file: 'd.png', colors: ['yellow', 'blue'], label: 'D' },
];

describe('filterPlates', () => {
  it('returns all plates when colorFilters is empty and no state selected', () => {
    expect(filterPlates(PLATES, new Set(), null)).toHaveLength(4);
  });

  it('filters by a single color', () => {
    const result = filterPlates(PLATES, new Set(['white']), null);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.state)).toEqual(expect.arrayContaining(['California', 'Texas']));
  });

  it('combines multiple color filters (AND logic — must have all selected colors)', () => {
    // plate a has [white, blue], plate b has [red], plate c has [white], plate d has [yellow, blue]
    // white AND blue → only plate a matches
    const result = filterPlates(PLATES, new Set(['white', 'blue']), null);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('a.png');
  });

  it('filters by selected state', () => {
    const result = filterPlates(PLATES, new Set(), 'California');
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.state === 'California')).toBe(true);
  });

  it('combines color and state filters', () => {
    const result = filterPlates(PLATES, new Set(['white']), 'California');
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('a.png');
  });

  it('returns empty array when no plates match', () => {
    expect(filterPlates(PLATES, new Set(['green']), null)).toHaveLength(0);
  });
});

describe('getHighlightedStates', () => {
  it('returns empty set when colorFilters is empty', () => {
    expect(getHighlightedStates(PLATES, new Set()).size).toBe(0);
  });

  it('returns states that have at least one plate with that color', () => {
    const result = getHighlightedStates(PLATES, new Set(['blue']));
    expect(result).toEqual(new Set(['California', 'Alaska']));
  });

  it('returns only states whose plates have ALL selected colors (AND logic)', () => {
    // blue AND yellow → only plate d (Alaska: [yellow, blue]) matches
    const result = getHighlightedStates(PLATES, new Set(['blue', 'yellow']));
    expect(result).toEqual(new Set(['Alaska']));
  });

  it('returns empty set when no plates have the selected color', () => {
    expect(getHighlightedStates(PLATES, new Set(['green'])).size).toBe(0);
  });
});

import { readFileSync } from 'fs';
import { join } from 'path';

describe('US_PLATES ↔ GeoJSON name reconciliation', () => {
  it('every US_PLATES state name resolves to a GeoJSON feature', () => {
    const geojson = JSON.parse(
      readFileSync(join(process.cwd(), 'public/us-states.geo.json'), 'utf-8')
    ) as { features: Array<{ properties: { name: string } }> };

    const geoNames = new Set(geojson.features.map((f) => f.properties.name));

    // Reverse of GEO_TO_PLATE_NAME: plateName → geoName
    const plateToGeo: Record<string, string> = {
      'Washington DC': 'District of Columbia',
    };

    const plateStates = [...new Set(US_PLATES.map((p) => p.state))];
    for (const state of plateStates) {
      const geoName = plateToGeo[state] ?? state;
      expect(geoNames.has(geoName)).toBe(true);
    }
  });
});
