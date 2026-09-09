import { setPendingFilter, takePendingFilter } from '@/lib/saved-filters/pending-filter';
import type { FilterRequest } from '@/types/map-data';

const sample: FilterRequest = {
  sideFilter: 'left',
  lineFilter: 'all',
  euPlateFilter: 'yes',
  cameraGenFilter: 'all',
  coverageYearFilter: '2024',
  carColorFilter: 'all',
  vehicleTypeFilter: 'all',
};

describe('pending filter handoff', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('stores and takes a pending filter exactly once', () => {
    setPendingFilter(sample);
    expect(takePendingFilter()).toEqual(sample);
    // Second read returns null because the value is consumed.
    expect(takePendingFilter()).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(takePendingFilter()).toBeNull();
  });

  it('returns null and consumes malformed stored data', () => {
    window.sessionStorage.setItem('gh_pending_filter', JSON.stringify({ sideFilter: 'left' }));
    expect(takePendingFilter()).toBeNull();
    // Malformed value is still consumed so it cannot poison later reads.
    expect(window.sessionStorage.getItem('gh_pending_filter')).toBeNull();
  });

  it('returns null when stored data is not valid JSON', () => {
    window.sessionStorage.setItem('gh_pending_filter', 'not-json');
    expect(takePendingFilter()).toBeNull();
  });
});
