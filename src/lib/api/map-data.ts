import { apiClient } from '@/lib/api/client';
import type {
  CarMetaResponse,
  FilterRequest,
  FilterResponse,
  MapDataResponse,
} from '@/types/map-data';

export function fetchGeoJson() {
  return apiClient.get<GeoJSON.FeatureCollection>('/api/data/geojson');
}

export function fetchMapData() {
  return apiClient.get<MapDataResponse>('/api/data/map');
}

export function fetchFilteredCountries(filters: FilterRequest) {
  return apiClient.post<FilterResponse>('/api/data/filter', filters);
}

export function fetchCarMetaData() {
  return apiClient.get<CarMetaResponse>('/api/data/car-meta');
}
