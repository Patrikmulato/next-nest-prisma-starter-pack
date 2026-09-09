import { apiClient } from '@/lib/api/client';
import type {
  CleanupUsefulMapBlobPayload,
  CreateUsefulMapPayload,
  IssueUsefulMapUploadTicketPayload,
  ListAdminUsefulMapsParams,
  ListPublicUsefulMapsParams,
  PaginatedUsefulMaps,
  PaginatedUsefulMapAdmin,
  UpdateUsefulMapPayload,
  UsefulMapCategory,
  UsefulMapAdmin,
  UsefulMapBlobCleanupRetryResult,
  UsefulMapUploadTicket,
} from '@/types/useful-maps';

export function listUsefulMapCategories({
  onlyWithImages = false,
}: { onlyWithImages?: boolean } = {}) {
  return apiClient.get<UsefulMapCategory[]>('/api/useful-maps/categories', {
    params: {
      onlyWithImages: String(onlyWithImages),
    },
  });
}

export function listPublicUsefulMaps(params: ListPublicUsefulMapsParams = {}) {
  const query: Record<string, string> = {};

  if (params.categorySlug) {
    query.categorySlug = params.categorySlug;
  }

  if (typeof params.page === 'number') {
    query.page = String(params.page);
  }

  if (typeof params.limit === 'number') {
    query.limit = String(params.limit);
  }

  return apiClient.get<PaginatedUsefulMaps>('/api/useful-maps/public', {
    params: query,
  });
}

export function listAdminUsefulMaps(params: ListAdminUsefulMapsParams = {}) {
  const query: Record<string, string> = {};

  if (params.categorySlug) {
    query.categorySlug = params.categorySlug;
  }

  if (typeof params.page === 'number') {
    query.page = String(params.page);
  }

  if (typeof params.limit === 'number') {
    query.limit = String(params.limit);
  }

  return apiClient.get<PaginatedUsefulMapAdmin>('/api/useful-maps/admin', {
    params: query,
  });
}

export function issueUsefulMapUploadTicket(payload: IssueUsefulMapUploadTicketPayload) {
  return apiClient.post<UsefulMapUploadTicket>('/api/useful-maps/upload-ticket', payload);
}

export function createUsefulMap(payload: CreateUsefulMapPayload) {
  return apiClient.post<UsefulMapAdmin>('/api/useful-maps', payload);
}

export function updateUsefulMap(id: string, payload: UpdateUsefulMapPayload) {
  return apiClient.put<UsefulMapAdmin>(`/api/useful-maps/${id}`, payload);
}

export function deleteUsefulMap(id: string) {
  return apiClient.delete<{ id: string; deleted: true }>(`/api/useful-maps/${id}`);
}

export function cleanupUsefulMapBlob(payload: CleanupUsefulMapBlobPayload) {
  return apiClient.post<{ id: string; deleted: true }>('/api/useful-maps/cleanup', payload);
}

export function retryUsefulMapBlobCleanup() {
  return apiClient.post<UsefulMapBlobCleanupRetryResult>('/api/useful-maps/cleanup/retry');
}
