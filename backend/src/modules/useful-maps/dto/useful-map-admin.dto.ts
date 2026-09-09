import { UsefulMapCategoryDto } from './useful-map-category.dto.js';

export class UsefulMapAdminDto {
  id!: string;
  title!: string;
  category!: UsefulMapCategoryDto;
  imageUrl!: string;
  blobPathname!: string;
  mimeType!: string;
  sizeBytes!: number;
  uploadedById!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class UsefulMapMutationResponseDto {
  id!: string;
  deleted!: true;
}

export class UsefulMapUploadTicketDto {
  ticket!: string;
  pathnamePrefix!: string;
  allowedContentTypes!: readonly string[];
  maximumSizeInBytes!: number;
  validUntil!: string;
  issuer!: string;
  audience!: string;
  access!: 'public';
}

export class UsefulMapBlobCleanupRetryResultDto {
  retried!: number;
  deleted!: number;
  failed!: number;
  remaining!: number;
}

export class PaginatedUsefulMapAdminDto {
  items!: UsefulMapAdminDto[];
  total!: number;
  page!: number;
  limit!: number;
}
