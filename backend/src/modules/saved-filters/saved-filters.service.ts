import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '../../../generated/prisma/index.js';
import { CacheStore } from '../../common/cache/cache.store.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parsePagination } from '../../common/utils/pagination.js';
import { FilterRequestDto } from '../data/dto/filter-request.dto.js';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto.js';
import { PaginatedSavedFiltersDto, SavedFilterDto } from './dto/saved-filter.dto.js';
import { UpdateSavedFilterDto } from './dto/update-saved-filter.dto.js';

const PUBLIC_SAVED_FILTERS_VERSION_KEY = 'cache:saved-filters:public:version';
const PUBLIC_SAVED_FILTERS_TTL_SECONDS = 120;

@Injectable()
export class SavedFiltersService {
  private readonly prisma: PrismaService;
  private readonly cacheStore: CacheStore;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(CacheStore) cacheStore: CacheStore
  ) {
    this.prisma = prisma;
    this.cacheStore = cacheStore;
  }

  private isAdmin(role: UserRole | 'USER' | 'CREATOR' | 'ADMIN'): boolean {
    return role === UserRole.ADMIN;
  }

  private assertCanManage(
    savedFilterUserId: string,
    requesterUserId: string,
    requesterRole: UserRole | 'USER' | 'CREATOR' | 'ADMIN'
  ): void {
    if (savedFilterUserId === requesterUserId || this.isAdmin(requesterRole)) {
      return;
    }

    throw new ForbiddenException('You do not have access to this saved filter');
  }

  private toDto(savedFilter: {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    filters: unknown;
    isPublic: boolean;
    views: number;
    createdAt: Date;
    updatedAt: Date;
  }): SavedFilterDto {
    return {
      id: savedFilter.id,
      userId: savedFilter.userId,
      name: savedFilter.name,
      description: savedFilter.description ?? undefined,
      filters: savedFilter.filters as FilterRequestDto,
      isPublic: savedFilter.isPublic,
      views: savedFilter.views,
      createdAt: savedFilter.createdAt,
      updatedAt: savedFilter.updatedAt,
    };
  }

  private buildPublicCacheKey(version: number, page: number, limit: number): string {
    return `cache:saved-filters:public:v${version}:p${page}:l${limit}`;
  }

  private async getPublicCacheVersion(): Promise<number> {
    const raw = await this.cacheStore.get(PUBLIC_SAVED_FILTERS_VERSION_KEY);
    if (!raw) {
      return 0;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private hydrateCachedPublicResult(raw: string): PaginatedSavedFiltersDto | undefined {
    try {
      const parsed = JSON.parse(raw) as PaginatedSavedFiltersDto;

      return {
        ...parsed,
        items: parsed.items.map((item) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        })),
      };
    } catch {
      return undefined;
    }
  }

  private async bumpPublicCacheVersion(): Promise<void> {
    await this.cacheStore.increment(PUBLIC_SAVED_FILTERS_VERSION_KEY);
  }

  async createSavedFilter(userId: string, dto: CreateSavedFilterDto): Promise<SavedFilterDto> {
    const savedFilter = await this.prisma.savedFilter.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        filters: dto.filters as unknown as Prisma.InputJsonValue,
        isPublic: dto.isPublic ?? false,
      },
    });

    await this.bumpPublicCacheVersion();

    return this.toDto(savedFilter);
  }

  async listSavedFilters(
    requesterUserId: string,
    requesterRole: UserRole | 'USER' | 'CREATOR' | 'ADMIN'
  ): Promise<SavedFilterDto[]> {
    const savedFilters = await this.prisma.savedFilter.findMany({
      where: this.isAdmin(requesterRole) ? undefined : { userId: requesterUserId },
      orderBy: { createdAt: 'desc' },
    });

    return savedFilters.map((savedFilter) => this.toDto(savedFilter));
  }

  async listOwnSavedFilters(userId: string): Promise<SavedFilterDto[]> {
    const savedFilters = await this.prisma.savedFilter.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return savedFilters.map((savedFilter) => this.toDto(savedFilter));
  }

  async listPublicSavedFilters(
    pageRaw?: string,
    limitRaw?: string
  ): Promise<PaginatedSavedFiltersDto> {
    const pagination = parsePagination(pageRaw, limitRaw);

    const version = await this.getPublicCacheVersion();
    const cacheKey = this.buildPublicCacheKey(version, pagination.page, pagination.limit);
    const cached = await this.cacheStore.get(cacheKey);
    if (cached) {
      const hydrated = this.hydrateCachedPublicResult(cached);
      if (hydrated) {
        return hydrated;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.savedFilter.findMany({
        where: { isPublic: true },
        orderBy: [{ views: 'desc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.savedFilter.count({ where: { isPublic: true } }),
    ]);

    const result: PaginatedSavedFiltersDto = {
      items: items.map((savedFilter) => this.toDto(savedFilter)),
      total,
      page: pagination.page,
      limit: pagination.limit,
    };

    await this.cacheStore.set(cacheKey, JSON.stringify(result), PUBLIC_SAVED_FILTERS_TTL_SECONDS);

    return result;
  }

  async getSavedFilterById(
    id: string,
    requesterUserId: string,
    requesterRole: UserRole | 'USER' | 'CREATOR' | 'ADMIN'
  ): Promise<SavedFilterDto> {
    const savedFilter = await this.prisma.savedFilter.findUnique({ where: { id } });
    if (!savedFilter) {
      throw new NotFoundException('Saved filter not found');
    }

    if (!savedFilter.isPublic) {
      this.assertCanManage(savedFilter.userId, requesterUserId, requesterRole);
    }

    return this.toDto(savedFilter);
  }

  async updateSavedFilter(
    id: string,
    requesterUserId: string,
    requesterRole: UserRole | 'USER' | 'CREATOR' | 'ADMIN',
    dto: UpdateSavedFilterDto
  ): Promise<SavedFilterDto> {
    const existing = await this.prisma.savedFilter.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Saved filter not found');
    }

    this.assertCanManage(existing.userId, requesterUserId, requesterRole);

    const updated = await this.prisma.savedFilter.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        filters: dto.filters as unknown as Prisma.InputJsonValue | undefined,
        isPublic: dto.isPublic,
      },
    });

    await this.bumpPublicCacheVersion();

    return this.toDto(updated);
  }

  async deleteSavedFilter(
    id: string,
    requesterUserId: string,
    requesterRole: UserRole | 'USER' | 'CREATOR' | 'ADMIN'
  ): Promise<{ id: string; deleted: true }> {
    const existing = await this.prisma.savedFilter.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Saved filter not found');
    }

    this.assertCanManage(existing.userId, requesterUserId, requesterRole);

    await this.prisma.savedFilter.delete({ where: { id } });
    await this.bumpPublicCacheVersion();
    return { id, deleted: true };
  }
}
