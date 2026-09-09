import { apiClient } from '@/lib/api/client';
import type {
  CreateSavedFilterPayload,
  PaginatedSavedFilters,
  SavedFilter,
  UpdateSavedFilterPayload,
} from '@/types/saved-filters';

export function createSavedFilter(payload: CreateSavedFilterPayload) {
  return apiClient.post<SavedFilter>('/api/saved-filters', payload);
}

export function listMySavedFilters() {
  return apiClient.get<SavedFilter[]>('/api/saved-filters/mine');
}

export function listPublicSavedFilters(page = 1, limit = 20) {
  return apiClient.get<PaginatedSavedFilters>('/api/saved-filters/public', {
    params: { page: String(page), limit: String(limit) },
  });
}

export function updateSavedFilter(id: string, payload: UpdateSavedFilterPayload) {
  return apiClient.put<SavedFilter>(`/api/saved-filters/${id}`, payload);
}

export function deleteSavedFilter(id: string) {
  return apiClient.delete<{ id: string; deleted: true }>(`/api/saved-filters/${id}`);
}
