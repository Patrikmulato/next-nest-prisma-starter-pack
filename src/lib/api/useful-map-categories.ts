import { apiClient } from '@/lib/api/client';
import type {
  CreateUsefulMapCategoryPayload,
  UpdateUsefulMapCategoryPayload,
  UsefulMapCategoryAdmin,
} from '@/types/useful-maps';

export function listAdminUsefulMapCategories() {
  return apiClient.get<UsefulMapCategoryAdmin[]>('/api/useful-map-categories');
}

export function createUsefulMapCategory(payload: CreateUsefulMapCategoryPayload) {
  return apiClient.post<UsefulMapCategoryAdmin>('/api/useful-map-categories', payload);
}

export function updateUsefulMapCategory(id: string, payload: UpdateUsefulMapCategoryPayload) {
  return apiClient.put<UsefulMapCategoryAdmin>(`/api/useful-map-categories/${id}`, payload);
}

export function deleteUsefulMapCategory(id: string) {
  return apiClient.delete<{ id: string; deleted: true }>(`/api/useful-map-categories/${id}`);
}
