import type { FilterRequest } from '@/types/map-data';

// Cross-page handoff: the public gallery stores a chosen filter, then navigates
// to the map page which applies and clears it on mount.
const PENDING_FILTER_KEY = 'gh_pending_filter';

const SIDE_FILTER_VALUES = new Set(['all', 'left', 'right']);
const EU_PLATE_FILTER_VALUES = new Set(['all', 'yes', 'no']);
const COVERAGE_YEAR_PATTERN = /^(all|\d{4})$/;

// Validates the fixed-enum/format fields exactly (they don't depend on backend
// data loaded at runtime). `lineFilter`, `carColorFilter`, `vehicleTypeFilter`,
// and `cameraGenFilter` are data-driven and are sanitized separately by the
// consumer once the current valid values are known (see src/app/page.tsx).
function isFilterRequest(value: unknown): value is FilterRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sideFilter === 'string' &&
    SIDE_FILTER_VALUES.has(candidate.sideFilter) &&
    typeof candidate.lineFilter === 'string' &&
    typeof candidate.euPlateFilter === 'string' &&
    EU_PLATE_FILTER_VALUES.has(candidate.euPlateFilter) &&
    typeof candidate.cameraGenFilter === 'string' &&
    typeof candidate.coverageYearFilter === 'string' &&
    COVERAGE_YEAR_PATTERN.test(candidate.coverageYearFilter) &&
    typeof candidate.carColorFilter === 'string' &&
    typeof candidate.vehicleTypeFilter === 'string'
  );
}

export function setPendingFilter(filters: FilterRequest): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(PENDING_FILTER_KEY, JSON.stringify(filters));
}

export function takePendingFilter(): FilterRequest | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(PENDING_FILTER_KEY);
  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(PENDING_FILTER_KEY);

  try {
    const parsed: unknown = JSON.parse(raw);
    return isFilterRequest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
