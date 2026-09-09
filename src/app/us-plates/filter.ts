import type { USPlate } from '@/data/us-plates';

export function filterPlates(
  plates: USPlate[],
  colorFilters: Set<string>,
  selectedState: string | null
): USPlate[] {
  let result = plates;
  if (colorFilters.size > 0) {
    result = result.filter((p) => [...colorFilters].every((c) => p.colors.includes(c)));
  }
  if (selectedState !== null) {
    result = result.filter((p) => p.state === selectedState);
  }
  return result;
}

export function getHighlightedStates(plates: USPlate[], colorFilters: Set<string>): Set<string> {
  if (colorFilters.size === 0) return new Set<string>();
  return new Set(
    plates.filter((p) => [...colorFilters].every((c) => p.colors.includes(c))).map((p) => p.state)
  );
}
