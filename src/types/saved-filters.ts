import type { FilterRequest } from '@/types/map-data';

export type SavedFilterValues = FilterRequest;

export interface SavedFilter {
  id: string;
  userId: string;
  name: string;
  description?: string;
  filters: SavedFilterValues;
  isPublic: boolean;
  views: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedSavedFilters {
  items: SavedFilter[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateSavedFilterPayload {
  name: string;
  description?: string;
  filters: SavedFilterValues;
  isPublic?: boolean;
}

export interface UpdateSavedFilterPayload {
  name?: string;
  description?: string;
  filters?: SavedFilterValues;
  isPublic?: boolean;
}
