export interface UsefulMapCategory {
  id: string;
  slug: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsefulMapCategoryAdmin extends UsefulMapCategory {
  mapCount: number;
}

export interface CreateUsefulMapCategoryPayload {
  slug: string;
  label: string;
}

export interface UpdateUsefulMapCategoryPayload {
  label: string;
}

export interface UsefulMapSummary {
  id: string;
  title: string;
  category: UsefulMapCategory;
  imageUrl: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface UsefulMapAdmin extends UsefulMapSummary {
  blobPathname: string;
  mimeType: string;
  uploadedById: string;
}

export interface PaginatedUsefulMaps {
  items: UsefulMapSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedUsefulMapAdmin {
  items: UsefulMapAdmin[];
  total: number;
  page: number;
  limit: number;
}

export interface UsefulMapUploadTicket {
  ticket: string;
  pathnamePrefix: string;
  allowedContentTypes: readonly string[];
  maximumSizeInBytes: number;
  validUntil: string;
  issuer: string;
  audience: string;
  access: 'public';
}

export interface ListPublicUsefulMapsParams {
  categorySlug?: string;
  page?: number;
  limit?: number;
}

export type ListAdminUsefulMapsParams = ListPublicUsefulMapsParams;

export interface IssueUsefulMapUploadTicketPayload {
  pathnamePrefix: string;
}

export interface CreateUsefulMapPayload {
  title: string;
  categorySlug: string;
  imageUrl: string;
  blobPathname: string;
  mimeType: string;
  sizeBytes: number;
  uploadTicket: string;
}

export interface UpdateUsefulMapPayload {
  title?: string;
  categorySlug?: string;
  imageUrl?: string;
  blobPathname?: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadTicket?: string;
}

export interface CleanupUsefulMapBlobPayload {
  imageUrl: string;
  blobPathname: string;
  uploadTicket: string;
}

export interface UsefulMapBlobCleanupRetryResult {
  retried: number;
  deleted: number;
  failed: number;
  remaining: number;
}
