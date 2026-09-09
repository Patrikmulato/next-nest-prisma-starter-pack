'use client';

import Link from 'next/link';
import { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import FilterDropdown from '@/components/FilterDropdown';
import SavedFiltersPanel from '@/components/SavedFiltersPanel';
import {
  fetchCarMetaData,
  fetchFilteredCountries,
  fetchGeoJson,
  fetchMapData,
} from '@/lib/api/map-data';
import { takePendingFilter } from '@/lib/saved-filters/pending-filter';
import type {
  CarColor,
  FilterRequest,
  MapDataResponse,
  RoadLinePattern,
  VehicleType,
} from '@/types/map-data';
import type { CarDot } from '@/components/WorldMap';

const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false });

const GREY_OUT = '#111827';
const NO_DATA = '#1f2937';

function toTitleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function Home() {
  const [sideFilter, setSideFilter] = useState<'all' | 'left' | 'right'>('all');
  const [lineFilter, setLineFilter] = useState<RoadLinePattern | 'all'>('all');
  const [euPlateFilter, setEuPlateFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [cameraGenFilter, setCameraGenFilter] = useState<'all' | string>('all');
  const [coverageYearFilter, setCoverageYearFilter] = useState<string>('all');
  const [carColorFilter, setCarColorFilter] = useState<'all' | CarColor>('all');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<'all' | VehicleType>('all');
  const [mapData, setMapData] = useState<MapDataResponse | null>(null);
  const [filteredCountries, setFilteredCountries] = useState<string[] | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [carDots, setCarDots] = useState<CarDot[]>([]);
  const [showCarDots, setShowCarDots] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      setIsInitialLoading(true);
      setInitialError(null);
      const mapRequest = fetchMapData();
      const geoJsonRequest = fetchGeoJson();

      try {
        const serverMapData = await mapRequest;
        if (!active) return;
        setMapData(serverMapData);
        // Render immediately with all GeoGuessr countries while filtered data loads.
        setFilteredCountries(serverMapData.geoguessrCountries);
      } catch (error) {
        if (!active) return;
        console.error('Map data load failed:', error);
        setInitialError('Failed to load map data from backend API.');
      }

      try {
        const geoJsonData = await geoJsonRequest;
        if (!active) return;
        setGeojson(geoJsonData);
      } catch (error) {
        if (!active) return;
        console.error('GeoJSON load failed:', error);
        setInitialError((prev) => prev ?? 'Failed to load country geometry from backend API.');
      } finally {
        if (!active) return;
        setIsInitialLoading(false);
      }
    }

    loadInitialData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!mapData) return;

    let active = true;

    async function loadFilteredCountries() {
      setFilterError(null);
      try {
        const res = await fetchFilteredCountries({
          sideFilter,
          lineFilter,
          euPlateFilter,
          cameraGenFilter,
          coverageYearFilter,
          carColorFilter,
          vehicleTypeFilter,
        });
        if (!active) return;
        setFilteredCountries(res.countries);
      } catch {
        if (!active) return;
        setFilterError('Failed to apply filters from backend.');
      }
    }

    loadFilteredCountries();

    return () => {
      active = false;
    };
  }, [
    mapData,
    sideFilter,
    lineFilter,
    euPlateFilter,
    cameraGenFilter,
    coverageYearFilter,
    carColorFilter,
    vehicleTypeFilter,
  ]);

  useEffect(() => {
    fetchCarMetaData()
      .then((data) => {
        const dots: CarDot[] = [];
        for (const coords of Object.values(data)) {
          for (const [lat, lng, colorIdx] of coords) {
            dots.push({ lat, lng, colorIdx });
          }
        }
        setCarDots(dots);
      })
      .catch(() => {
        // Car dots are an optional overlay — silently skip if unavailable
      });
  }, []);

  const allLinePatterns = useMemo(() => {
    if (!mapData) return [] as RoadLinePattern[];
    return Object.keys(mapData.linePatternLabels) as RoadLinePattern[];
  }, [mapData]);

  const linePatternGroups = useMemo(() => {
    if (!mapData) return [] as { label: string; patterns: RoadLinePattern[] }[];

    const grouped = new Map<string, RoadLinePattern[]>();
    allLinePatterns.forEach((pattern) => {
      const [outside = 'other'] = pattern.split('-');
      const existing = grouped.get(outside) ?? [];
      grouped.set(outside, [...existing, pattern]);
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([outside, patterns]) => ({
        label: `Outside: ${toTitleCase(outside)}`,
        patterns: [...patterns].sort((a, b) =>
          (mapData.linePatternLabels[a] ?? a).localeCompare(mapData.linePatternLabels[b] ?? b)
        ),
      }));
  }, [allLinePatterns, mapData]);

  const allCarColors = useMemo(() => {
    if (!mapData) return [] as CarColor[];
    const colors = new Set<CarColor>();
    Object.values(mapData.carColorData).forEach((countryColors) => {
      countryColors.forEach((c) => colors.add(c));
    });
    // white is default fallback color even if omitted from country-specific map
    colors.add('white');
    return Array.from(colors).sort((a, b) => a.localeCompare(b));
  }, [mapData]);

  const allVehicleTypes = useMemo(() => {
    if (!mapData) return [] as VehicleType[];
    const vehicleTypes = new Set<VehicleType>(['car']);
    Object.values(mapData.vehicleTypeData).forEach((v) => vehicleTypes.add(v));
    return Array.from(vehicleTypes).sort((a, b) => a.localeCompare(b));
  }, [mapData]);

  const allCoverageYears = useMemo(() => {
    if (!mapData) return [] as number[];
    const years = new Set<number>();
    Object.values(mapData.coverageYearsData).forEach((countryYears) => {
      countryYears.forEach((y) => years.add(y));
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [mapData]);

  const allCameraGens = useMemo(() => {
    if (!mapData) return [] as string[];
    const gens = new Set<string>();
    Object.values(mapData.cameraGenData).forEach((countryGens) => {
      countryGens.forEach((g) => gens.add(String(g)));
    });
    return Array.from(gens).sort((a, b) => Number(a) - Number(b));
  }, [mapData]);

  const geoguessrSet = useMemo(() => new Set(mapData?.geoguessrCountries ?? []), [mapData]);

  const filteredSet = useMemo(() => new Set(filteredCountries ?? []), [filteredCountries]);

  const getColor = useCallback(
    (geoName: string) => {
      if (!mapData) return NO_DATA;

      const name = mapData.aliases[geoName] ?? geoName;
      if (!geoguessrSet.has(name)) return GREY_OUT;
      if (!filteredSet.has(name)) return NO_DATA;

      // Color priority: specific line filter > driving side filter > default
      if (lineFilter !== 'all') return mapData.linePatternColors[lineFilter];

      if (sideFilter !== 'all') {
        return sideFilter === 'left' ? '#3b82f6' : '#ef4444';
      }

      // Default: color by driving side
      const side = mapData.drivingSideData[name];
      if (!side) return NO_DATA;
      return side === 'left' ? '#3b82f6' : '#ef4444';
    },
    [mapData, geoguessrSet, filteredSet, lineFilter, sideFilter]
  );

  const getTooltip = useCallback(
    (geoName: string) => {
      if (!mapData) return geoName;

      const name = mapData.aliases[geoName] ?? geoName;
      if (!geoguessrSet.has(name)) return `${name}: Not in GeoGuessr`;

      return mapData.tooltipHtmlByCountry[name] ?? `<strong>${name}</strong>`;
    },
    [mapData, geoguessrSet]
  );

  const hasActiveFilters =
    sideFilter !== 'all' ||
    lineFilter !== 'all' ||
    euPlateFilter !== 'all' ||
    cameraGenFilter !== 'all' ||
    coverageYearFilter !== 'all' ||
    carColorFilter !== 'all' ||
    vehicleTypeFilter !== 'all';

  const resetFilters = useCallback(() => {
    setSideFilter('all');
    setLineFilter('all');
    setEuPlateFilter('all');
    setCameraGenFilter('all');
    setCoverageYearFilter('all');
    setCarColorFilter('all');
    setVehicleTypeFilter('all');
  }, []);

  const currentFilters = useMemo<FilterRequest>(
    () => ({
      sideFilter,
      lineFilter,
      euPlateFilter,
      cameraGenFilter,
      coverageYearFilter,
      carColorFilter,
      vehicleTypeFilter,
    }),
    [
      sideFilter,
      lineFilter,
      euPlateFilter,
      cameraGenFilter,
      coverageYearFilter,
      carColorFilter,
      vehicleTypeFilter,
    ]
  );

  const applyFilters = useCallback((filters: FilterRequest) => {
    setSideFilter(filters.sideFilter);
    setLineFilter(filters.lineFilter);
    setEuPlateFilter(filters.euPlateFilter);
    setCameraGenFilter(filters.cameraGenFilter);
    setCoverageYearFilter(filters.coverageYearFilter);
    setCarColorFilter(filters.carColorFilter);
    setVehicleTypeFilter(filters.vehicleTypeFilter);
  }, []);

  // Clamp data-dependent fields to the currently valid values so a stale or
  // tampered filter — whether from the public gallery or a user's own older
  // preset — can't push the map into a dead-end state. Fixed-enum fields are
  // already validated upstream.
  const sanitizeFilters = useCallback(
    (filters: FilterRequest): FilterRequest => ({
      ...filters,
      lineFilter:
        filters.lineFilter === 'all' ||
        allLinePatterns.includes(filters.lineFilter as RoadLinePattern)
          ? filters.lineFilter
          : 'all',
      carColorFilter:
        filters.carColorFilter === 'all' ||
        allCarColors.includes(filters.carColorFilter as CarColor)
          ? filters.carColorFilter
          : 'all',
      vehicleTypeFilter:
        filters.vehicleTypeFilter === 'all' ||
        allVehicleTypes.includes(filters.vehicleTypeFilter as VehicleType)
          ? filters.vehicleTypeFilter
          : 'all',
      cameraGenFilter:
        filters.cameraGenFilter === 'all' || allCameraGens.includes(filters.cameraGenFilter)
          ? filters.cameraGenFilter
          : 'all',
    }),
    [allLinePatterns, allCarColors, allVehicleTypes, allCameraGens]
  );

  const applySanitizedFilters = useCallback(
    (filters: FilterRequest) => applyFilters(sanitizeFilters(filters)),
    [applyFilters, sanitizeFilters]
  );

  // Apply a filter handed off from the public gallery, once mapData is available.
  useEffect(() => {
    if (!mapData) return;

    const pending = takePendingFilter();
    if (!pending) return;

    // One-time sync of UI state from an external store (sessionStorage handoff).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applySanitizedFilters(pending);
  }, [mapData, applySanitizedFilters]);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Persistent filter sidebar */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-zinc-800 bg-[#181c22]">
        <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
          {filterError && <p className="mb-1 text-[11px] text-red-400">{filterError}</p>}

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Driving Side
            </p>
            <FilterDropdown
              value={sideFilter}
              onChange={setSideFilter}
              placeholder="Driving Side: All"
              openDirection="right"
              options={[
                { value: 'all', label: 'Driving Side: All' },
                { value: 'left', label: 'Driving Side: Left' },
                { value: 'right', label: 'Driving Side: Right' },
              ]}
            />
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Road Lines
            </p>
            <FilterDropdown
              value={lineFilter}
              onChange={(v) => setLineFilter(v as RoadLinePattern | 'all')}
              placeholder="Road Lines: All"
              openDirection="right"
              groups={[
                {
                  label: '',
                  options: [{ value: 'all', label: 'Road Lines: All' }],
                },
                ...linePatternGroups.map((g) => ({
                  label: g.label,
                  options: g.patterns.map((p) => ({
                    value: p,
                    label: mapData?.linePatternLabels[p] ?? p,
                  })),
                })),
              ]}
            />
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              EU Plate
            </p>
            <FilterDropdown
              value={euPlateFilter}
              onChange={(v) => setEuPlateFilter(v as typeof euPlateFilter)}
              placeholder="EU Plate: All"
              openDirection="right"
              options={[
                { value: 'all', label: 'EU Plate: All' },
                { value: 'yes', label: 'Yes — EU blue strip' },
                { value: 'no', label: 'No — non-EU plate' },
              ]}
            />
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Camera Generation
            </p>
            <FilterDropdown
              value={cameraGenFilter}
              onChange={(v) => setCameraGenFilter(v as typeof cameraGenFilter)}
              placeholder="Camera Gen: All"
              openDirection="right"
              options={[
                { value: 'all', label: 'Camera Gen: All' },
                ...allCameraGens.map((gen) => ({
                  value: gen,
                  label: `Gen ${gen}`,
                })),
              ]}
            />
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Coverage Year
            </p>
            <FilterDropdown
              value={coverageYearFilter}
              onChange={setCoverageYearFilter}
              placeholder="Coverage: Any year"
              openDirection="right"
              options={[
                { value: 'all', label: 'Coverage: Any year' },
                ...allCoverageYears.map((y) => ({
                  value: String(y),
                  label: String(y),
                })),
              ]}
            />
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Car Color
            </p>
            <FilterDropdown
              value={carColorFilter}
              onChange={(v) => setCarColorFilter(v as typeof carColorFilter)}
              placeholder="Car Color: All"
              openDirection="right"
              options={[
                { value: 'all', label: 'Car Color: All' },
                ...allCarColors.map((color) => ({
                  value: color,
                  label: toTitleCase(color),
                })),
              ]}
            />
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Vehicle Type
            </p>
            <FilterDropdown
              value={vehicleTypeFilter}
              onChange={(v) => setVehicleTypeFilter(v as typeof vehicleTypeFilter)}
              placeholder="Vehicle: All"
              openDirection="right"
              options={[
                { value: 'all', label: 'Vehicle: All' },
                ...allVehicleTypes.map((type) => ({
                  value: type,
                  label: type === 'truck' ? 'Truck / Pickup' : toTitleCase(type),
                })),
              ]}
            />
          </div>
        </div>

        <div className="border-t border-zinc-800 px-3 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Car Dots
            </span>
            <button
              type="button"
              onClick={() => setShowCarDots((v) => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${showCarDots ? 'bg-blue-600' : 'bg-zinc-700'}`}
              role="switch"
              aria-checked={showCarDots}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showCarDots ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </button>
          </div>
          <SavedFiltersPanel currentFilters={currentFilters} onApply={applySanitizedFilters} />
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className="w-full rounded-lg border border-red-600 bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 hover:border-red-700 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800/40 disabled:text-zinc-600"
          >
            Reset Filters
          </button>
        </div>
      </aside>

      {/* Map */}
      <main className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute bottom-3 right-3 z-[500] sm:bottom-4 sm:right-4">
          <Link
            href="/filters"
            className="pointer-events-auto inline-flex rounded-full border border-zinc-700 bg-[#20262e]/95 px-3 py-1.5 text-xs font-semibold text-zinc-100 shadow-lg transition-colors hover:border-zinc-500 hover:bg-[#27303b]"
          >
            Public Filters
          </Link>
        </div>

        {initialError ? (
          <div className="flex h-full items-center justify-center text-red-400">{initialError}</div>
        ) : geojson && mapData && filteredCountries ? (
          <WorldMap
            geojson={geojson}
            getColor={getColor}
            getTooltip={getTooltip}
            carDots={showCarDots ? carDots : []}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-500">
            {isInitialLoading ? 'Loading map…' : 'Waiting for data…'}
          </div>
        )}
      </main>
    </div>
  );
}
