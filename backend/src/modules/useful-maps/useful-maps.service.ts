import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { del } from '@vercel/blob';
import { Prisma } from '../../../generated/prisma/index.js';
import { CacheStore } from '../../common/cache/cache.store.js';
import { LoggerService } from '../../common/logger/logger.service.js';
import { sortByLabel } from '../../common/utils/sort-by-label.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { getUsefulMapsConfig } from '../../config/useful-maps.config.js';
import { UsefulMapCategoryDto } from './dto/useful-map-category.dto.js';
import { PaginatedUsefulMapsDto, UsefulMapDto } from './dto/useful-map.dto.js';
import { ListPublicUsefulMapsQueryDto } from './dto/list-public-useful-maps-query.dto.js';
import { headPublicBlob } from './blob.adapter.js';
import { CleanupUsefulMapBlobDto } from './dto/cleanup-useful-map-blob.dto.js';
import { CreateUsefulMapDto } from './dto/create-useful-map.dto.js';
import { IssueUsefulMapUploadTicketDto } from './dto/issue-upload-ticket.dto.js';
import {
  UsefulMapAdminDto,
  PaginatedUsefulMapAdminDto,
  UsefulMapMutationResponseDto,
  UsefulMapUploadTicketDto,
} from './dto/useful-map-admin.dto.js';
import { UpdateUsefulMapDto } from './dto/update-useful-map.dto.js';
import {
  signUsefulMapUploadTicket,
  verifyUsefulMapUploadTicket,
  type UsefulMapUploadTicketClaims,
} from './upload-ticket.js';

const PUBLIC_USEFUL_MAPS_VERSION_KEY = 'cache:useful-maps:public:version';
const USEFUL_MAP_BLOB_CLEANUP_QUEUE_KEY = 'cache:useful-maps:blob-cleanup-queue';
const USEFUL_MAP_BLOB_CLEANUP_QUEUE_TTL_SECONDS = 7 * 24 * 60 * 60;
const USEFUL_MAP_BLOB_CLEANUP_RETRY_BATCH_SIZE = 25;

type CategoryRecord = {
  id: string;
  slug: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
};

type UsefulMapRecord = {
  id: string;
  title: string;
  imageUrl: string;
  blobPathname: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  createdAt: Date;
  updatedAt: Date;
  category: CategoryRecord;
};

type BlobCleanupQueueEntry = {
  imageUrl: string;
  blobPathname: string;
  attempts: number;
  lastError: string;
  firstQueuedAt: string;
  updatedAt: string;
};

@Injectable()
export class UsefulMapsService {
  private readonly prisma: PrismaService;
  private readonly cacheStore: CacheStore;
  private readonly logger: LoggerService;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(CacheStore) cacheStore: CacheStore,
    @Inject(LoggerService) logger: LoggerService
  ) {
    this.prisma = prisma;
    this.cacheStore = cacheStore;
    this.logger = logger;
  }

  private normalizePathPrefix(prefix: string): string {
    let endIndex = prefix.length;

    while (endIndex > 0 && prefix.charAt(endIndex - 1) === '/') {
      endIndex -= 1;
    }

    return prefix.slice(0, endIndex);
  }

  private matchesPathnamePrefix(pathname: string, prefix: string): boolean {
    const normalizedPrefix = this.normalizePathPrefix(prefix);
    if (pathname === normalizedPrefix) {
      return true;
    }

    if (!pathname.startsWith(normalizedPrefix)) {
      return false;
    }

    const separator = pathname.charAt(normalizedPrefix.length);
    return separator === '/' || separator === '.' || separator === '-' || separator === '_';
  }

  private toCategoryDto(category: CategoryRecord): UsefulMapCategoryDto {
    return {
      id: category.id,
      slug: category.slug,
      label: category.label,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private toUsefulMapDto(record: UsefulMapRecord): UsefulMapDto {
    return {
      id: record.id,
      title: record.title,
      category: this.toCategoryDto(record.category),
      imageUrl: record.imageUrl,
      sizeBytes: record.sizeBytes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toAdminDto(record: UsefulMapRecord): UsefulMapAdminDto {
    return {
      id: record.id,
      title: record.title,
      category: this.toCategoryDto(record.category),
      imageUrl: record.imageUrl,
      blobPathname: record.blobPathname,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      uploadedById: record.uploadedById,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private assertUploadTicket(ticket: string, expectedPrefix?: string): UsefulMapUploadTicketClaims {
    const config = getUsefulMapsConfig();

    return verifyUsefulMapUploadTicket(ticket, {
      secret: config.uploadTicketSecret,
      expectedIssuer: config.uploadTicketIssuer,
      expectedAudience: config.uploadTicketAudience,
      pathnamePrefix: expectedPrefix,
    });
  }

  private async getCategoryBySlug(slug: string): Promise<CategoryRecord> {
    const category = await this.prisma.usefulMapCategory.findUnique({ where: { slug } });
    if (!category) {
      throw new NotFoundException('Useful map category not found');
    }

    return category;
  }

  private async getUsefulMapById(id: string): Promise<UsefulMapRecord> {
    const usefulMap = await this.prisma.usefulMap.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!usefulMap) {
      throw new NotFoundException('Useful map not found');
    }

    return usefulMap as UsefulMapRecord;
  }

  private assertAllowedPublicBlobUrl(imageUrl: string): string {
    let parsedImageUrl: URL;

    try {
      parsedImageUrl = new URL(imageUrl);
    } catch {
      throw new BadRequestException('Image URL is invalid');
    }

    if (parsedImageUrl.protocol !== 'https:') {
      throw new BadRequestException('Image URL must use HTTPS');
    }

    return parsedImageUrl.toString();
  }

  private async verifyBlobAgainstMetadata(input: {
    imageUrl: string;
    blobPathname: string;
    mimeType: string;
    sizeBytes: number;
    uploadTicket: string;
    requesterUserId: string;
  }): Promise<UsefulMapUploadTicketClaims> {
    const claims = this.assertUploadTicket(input.uploadTicket);
    if (claims.sub !== input.requesterUserId) {
      throw new BadRequestException('Upload ticket subject does not match the requester');
    }

    if (!this.matchesPathnamePrefix(input.blobPathname, claims.pathnamePrefix)) {
      throw new BadRequestException('Blob pathname does not match upload ticket');
    }

    if (!claims.allowedContentTypes.includes(input.mimeType)) {
      throw new BadRequestException('Blob MIME type is not permitted by the ticket');
    }

    if (input.sizeBytes > claims.maximumSizeInBytes) {
      throw new BadRequestException('Blob exceeds the maximum size permitted by the ticket');
    }

    const config = getUsefulMapsConfig();
    const validatedImageUrl = this.assertAllowedPublicBlobUrl(input.imageUrl);
    const blobHead = await headPublicBlob(validatedImageUrl, config.allowedBlobHosts);
    if (blobHead.contentType && blobHead.contentType !== input.mimeType) {
      throw new BadRequestException('Blob content type does not match metadata');
    }

    if (blobHead.contentLength !== null && blobHead.contentLength !== input.sizeBytes) {
      throw new BadRequestException('Blob size does not match metadata');
    }

    return claims;
  }

  async issueUploadTicket(
    requesterUserId: string,
    dto: IssueUsefulMapUploadTicketDto
  ): Promise<UsefulMapUploadTicketDto> {
    const config = getUsefulMapsConfig();
    const normalizedPathnamePrefix = this.normalizePathPrefix(dto.pathnamePrefix);
    const validUntil = new Date(Date.now() + 15 * 60_000);
    const claims: UsefulMapUploadTicketClaims = {
      iss: config.uploadTicketIssuer,
      aud: config.uploadTicketAudience,
      sub: requesterUserId,
      role: 'ADMIN',
      pathnamePrefix: normalizedPathnamePrefix,
      allowedContentTypes: config.allowedUploadMimeTypes,
      maximumSizeInBytes: config.maxUploadBytes,
      exp: Math.floor(validUntil.getTime() / 1000),
      iat: Math.floor(Date.now() / 1000),
      jti: randomUUID(),
    };

    const ticket = signUsefulMapUploadTicket(claims, config.uploadTicketSecret);

    return {
      ticket,
      pathnamePrefix: normalizedPathnamePrefix,
      allowedContentTypes: claims.allowedContentTypes,
      maximumSizeInBytes: claims.maximumSizeInBytes,
      validUntil: validUntil.toISOString(),
      issuer: claims.iss,
      audience: claims.aud,
      access: 'public',
    };
  }

  async createUsefulMap(
    requesterUserId: string,
    dto: CreateUsefulMapDto
  ): Promise<UsefulMapAdminDto> {
    await this.verifyBlobAgainstMetadata({
      imageUrl: dto.imageUrl,
      blobPathname: dto.blobPathname,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      uploadTicket: dto.uploadTicket,
      requesterUserId,
    });
    const category = await this.getCategoryBySlug(dto.categorySlug);

    const duplicate = await this.prisma.usefulMap.findFirst({
      where: {
        OR: [{ blobPathname: dto.blobPathname }, { imageUrl: dto.imageUrl }],
      },
    });
    if (duplicate) {
      throw new ConflictException('Useful map already exists for this blob');
    }

    this.logger.log('UsefulMapsService', 'Creating useful map', {
      userId: requesterUserId,
      blobPathname: dto.blobPathname,
      categorySlug: dto.categorySlug,
    });

    const created = await this.prisma.usefulMap.create({
      data: {
        title: dto.title,
        categoryId: category.id,
        imageUrl: dto.imageUrl,
        blobPathname: dto.blobPathname,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        uploadedById: requesterUserId,
      },
      include: {
        category: true,
      },
    });

    await this.bumpPublicCacheVersion();
    return this.toAdminDto(created as UsefulMapRecord);
  }

  async updateUsefulMap(
    id: string,
    requesterUserId: string,
    dto: UpdateUsefulMapDto
  ): Promise<UsefulMapAdminDto> {
    const existing = await this.getUsefulMapById(id);
    const previousImageUrl = existing.imageUrl;

    let categoryId = existing.category.id;
    if (dto.categorySlug) {
      categoryId = (await this.getCategoryBySlug(dto.categorySlug)).id;
    }

    const changingBlobFields =
      dto.imageUrl !== undefined ||
      dto.blobPathname !== undefined ||
      dto.mimeType !== undefined ||
      dto.sizeBytes !== undefined;

    const hasCompleteBlobMetadata =
      dto.imageUrl !== undefined &&
      dto.blobPathname !== undefined &&
      dto.mimeType !== undefined &&
      dto.sizeBytes !== undefined &&
      dto.uploadTicket !== undefined;

    if (changingBlobFields && !hasCompleteBlobMetadata) {
      throw new BadRequestException(
        'Complete blob metadata and uploadTicket are required when changing blob fields'
      );
    }

    if (hasCompleteBlobMetadata) {
      await this.verifyBlobAgainstMetadata({
        imageUrl: dto.imageUrl!,
        blobPathname: dto.blobPathname!,
        mimeType: dto.mimeType!,
        sizeBytes: dto.sizeBytes!,
        uploadTicket: dto.uploadTicket!,
        requesterUserId,
      });
    }

    this.logger.log('UsefulMapsService', 'Updating useful map', {
      userId: requesterUserId,
      usefulMapId: id,
    });

    const updated = await this.prisma.usefulMap.update({
      where: { id },
      data: {
        title: dto.title,
        categoryId,
        imageUrl: dto.imageUrl,
        blobPathname: dto.blobPathname,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
      },
      include: { category: true },
    });

    if (
      hasCompleteBlobMetadata &&
      dto.imageUrl !== undefined &&
      dto.imageUrl !== previousImageUrl
    ) {
      await this.deleteBlobWithQueue(previousImageUrl, existing.blobPathname, {
        userId: requesterUserId,
        usefulMapId: id,
        operation: 'update',
      });
    }

    await this.bumpPublicCacheVersion();
    return this.toAdminDto(updated as UsefulMapRecord);
  }

  async deleteUsefulMap(
    id: string,
    requesterUserId: string
  ): Promise<UsefulMapMutationResponseDto> {
    const existing = await this.getUsefulMapById(id);

    this.logger.log('UsefulMapsService', 'Deleting useful map', {
      userId: requesterUserId,
      usefulMapId: id,
      blobPathname: existing.blobPathname,
    });

    await this.prisma.usefulMap.delete({ where: { id } });
    await this.bumpPublicCacheVersion();
    await this.deleteBlobWithQueue(existing.imageUrl, existing.blobPathname, {
      userId: requesterUserId,
      usefulMapId: id,
      operation: 'delete',
    });

    return { id, deleted: true };
  }

  async cleanupUploadedBlob(
    requesterUserId: string,
    dto: CleanupUsefulMapBlobDto
  ): Promise<UsefulMapMutationResponseDto> {
    const existing = await this.prisma.usefulMap.findFirst({
      where: {
        OR: [{ blobPathname: dto.blobPathname }, { imageUrl: dto.imageUrl }],
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Cleanup is not allowed when a useful map record already exists'
      );
    }

    const claims = this.assertUploadTicket(dto.uploadTicket);
    if (claims.sub !== requesterUserId) {
      throw new BadRequestException('Upload ticket subject does not match the requester');
    }

    if (!this.matchesPathnamePrefix(dto.blobPathname, claims.pathnamePrefix)) {
      throw new BadRequestException('Blob pathname does not match upload ticket');
    }

    this.logger.warn('UsefulMapsService', 'Cleaning up orphaned useful map blob', {
      userId: requesterUserId,
      blobPathname: dto.blobPathname,
    });

    await del(dto.imageUrl);
    return { id: dto.blobPathname, deleted: true };
  }

  private async getBlobCleanupQueue(): Promise<BlobCleanupQueueEntry[]> {
    const raw = await this.cacheStore.get(USEFUL_MAP_BLOB_CLEANUP_QUEUE_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((entry): entry is BlobCleanupQueueEntry => {
        if (!entry || typeof entry !== 'object') {
          return false;
        }

        const record = entry as Record<string, unknown>;
        return (
          typeof record.imageUrl === 'string' &&
          typeof record.blobPathname === 'string' &&
          typeof record.attempts === 'number' &&
          typeof record.lastError === 'string' &&
          typeof record.firstQueuedAt === 'string' &&
          typeof record.updatedAt === 'string'
        );
      });
    } catch {
      return [];
    }
  }

  private async setBlobCleanupQueue(entries: BlobCleanupQueueEntry[]): Promise<void> {
    if (entries.length === 0) {
      await this.cacheStore.set(USEFUL_MAP_BLOB_CLEANUP_QUEUE_KEY, '[]', 60);
      return;
    }

    await this.cacheStore.set(
      USEFUL_MAP_BLOB_CLEANUP_QUEUE_KEY,
      JSON.stringify(entries),
      USEFUL_MAP_BLOB_CLEANUP_QUEUE_TTL_SECONDS
    );
  }

  private async queueBlobCleanup(
    imageUrl: string,
    blobPathname: string,
    error: string
  ): Promise<void> {
    const currentQueue = await this.getBlobCleanupQueue();
    const now = new Date().toISOString();
    const existingIndex = currentQueue.findIndex((entry) => entry.blobPathname === blobPathname);

    if (existingIndex >= 0) {
      const existingEntry = currentQueue[existingIndex];
      currentQueue[existingIndex] = {
        ...existingEntry,
        imageUrl,
        attempts: existingEntry.attempts + 1,
        lastError: error,
        updatedAt: now,
      };
    } else {
      currentQueue.push({
        imageUrl,
        blobPathname,
        attempts: 1,
        lastError: error,
        firstQueuedAt: now,
        updatedAt: now,
      });
    }

    await this.setBlobCleanupQueue(currentQueue);
  }

  private async deleteBlobWithQueue(
    imageUrl: string,
    blobPathname: string,
    context: { userId: string; usefulMapId: string; operation: 'update' | 'delete' }
  ): Promise<void> {
    try {
      await del(imageUrl);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown blob deletion error';
      await this.queueBlobCleanup(imageUrl, blobPathname, message);
      this.logger.warn('UsefulMapsService', 'Blob deletion failed and was queued for retry', {
        ...context,
        imageUrl,
        blobPathname,
        error: message,
      });
    }
  }

  async retryBlobCleanup(requesterUserId: string): Promise<{
    retried: number;
    deleted: number;
    failed: number;
    remaining: number;
  }> {
    const queue = await this.getBlobCleanupQueue();
    if (queue.length === 0) {
      return { retried: 0, deleted: 0, failed: 0, remaining: 0 };
    }

    const now = new Date().toISOString();
    const toRetry = queue.slice(0, USEFUL_MAP_BLOB_CLEANUP_RETRY_BATCH_SIZE);
    const untouched = queue.slice(USEFUL_MAP_BLOB_CLEANUP_RETRY_BATCH_SIZE);
    const failedEntries: BlobCleanupQueueEntry[] = [];

    let deleted = 0;
    for (const entry of toRetry) {
      try {
        await del(entry.imageUrl);
        deleted += 1;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown blob deletion error';
        failedEntries.push({
          ...entry,
          attempts: entry.attempts + 1,
          lastError: message,
          updatedAt: now,
        });
      }
    }

    const remainingQueue = [...failedEntries, ...untouched];
    await this.setBlobCleanupQueue(remainingQueue);

    this.logger.log('UsefulMapsService', 'Retried queued useful map blob cleanup jobs', {
      userId: requesterUserId,
      retried: toRetry.length,
      deleted,
      failed: failedEntries.length,
      remaining: remainingQueue.length,
    });

    return {
      retried: toRetry.length,
      deleted,
      failed: failedEntries.length,
      remaining: remainingQueue.length,
    };
  }

  private async getPublicCacheVersion(): Promise<number> {
    const raw = await this.cacheStore.get(PUBLIC_USEFUL_MAPS_VERSION_KEY);
    if (!raw) {
      return 0;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async bumpPublicCacheVersion(): Promise<void> {
    await this.cacheStore.increment(PUBLIC_USEFUL_MAPS_VERSION_KEY);
  }

  private buildCacheKey(
    version: number,
    categorySlug: string,
    page: number,
    limit: number
  ): string {
    return `cache:useful-maps:public:v${version}:c${categorySlug}:p${page}:l${limit}`;
  }

  async listCategories(onlyWithImages = false): Promise<UsefulMapCategoryDto[]> {
    const categories = await this.prisma.usefulMapCategory.findMany({
      where: onlyWithImages ? { usefulMaps: { some: {} } } : undefined,
    });

    return sortByLabel(categories.map((category) => this.toCategoryDto(category)));
  }

  async listPublicUsefulMaps(query: ListPublicUsefulMapsQueryDto): Promise<PaginatedUsefulMapsDto> {
    const config = getUsefulMapsConfig();
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 12, config.publicPageSizeMax);
    const categorySlug = query.categorySlug?.trim();

    if (query.categorySlug && !categorySlug) {
      throw new BadRequestException('Invalid useful map category');
    }

    const category = categorySlug
      ? await this.prisma.usefulMapCategory.findUnique({ where: { slug: categorySlug } })
      : null;

    if (categorySlug && !category) {
      throw new NotFoundException('Useful map category not found');
    }

    const version = await this.getPublicCacheVersion();
    const cacheKey = this.buildCacheKey(version, categorySlug ?? 'all', page, limit);
    const cached = await this.cacheStore.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as PaginatedUsefulMapsDto;
        return {
          ...parsed,
          items: parsed.items.map((item) => ({
            ...item,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt),
            category: {
              ...item.category,
              createdAt: new Date(item.category.createdAt),
              updatedAt: new Date(item.category.updatedAt),
            },
          })),
        };
      } catch {
        // Ignore malformed cached entries and recompute.
      }
    }

    const where: Prisma.UsefulMapWhereInput | undefined = category
      ? { categoryId: category.id }
      : undefined;

    const [items, total] = await Promise.all([
      this.prisma.usefulMap.findMany({
        where,
        include: {
          category: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.usefulMap.count({ where }),
    ]);

    const result: PaginatedUsefulMapsDto = {
      items: items.map((item) => this.toUsefulMapDto(item as UsefulMapRecord)),
      total,
      page,
      limit,
    };

    await this.cacheStore.set(cacheKey, JSON.stringify(result), config.publicCacheTtlSeconds);

    return result;
  }

  async listAdminUsefulMaps(
    query: ListPublicUsefulMapsQueryDto
  ): Promise<PaginatedUsefulMapAdminDto> {
    const config = getUsefulMapsConfig();
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 24, config.publicPageSizeMax);
    const categorySlug = query.categorySlug?.trim();

    const category = categorySlug
      ? await this.prisma.usefulMapCategory.findUnique({ where: { slug: categorySlug } })
      : null;

    if (categorySlug && !category) {
      throw new NotFoundException('Useful map category not found');
    }

    const where: Prisma.UsefulMapWhereInput | undefined = category
      ? { categoryId: category.id }
      : undefined;

    const [items, total] = await Promise.all([
      this.prisma.usefulMap.findMany({
        where,
        include: { category: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.usefulMap.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toAdminDto(item as UsefulMapRecord)),
      total,
      page,
      limit,
    };
  }

  async invalidatePublicCache(): Promise<void> {
    await this.bumpPublicCacheVersion();
  }
}
