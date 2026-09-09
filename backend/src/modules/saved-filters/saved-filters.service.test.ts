import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../../generated/prisma/index.js';
import { SavedFiltersService } from './saved-filters.service.js';
import type { CacheStore } from '../../common/cache/cache.store.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function makeDate(value: string): Date {
  return new Date(value);
}

function makeCacheStoreMock(overrides?: Partial<CacheStore>): CacheStore {
  const base = {
    get: async () => undefined,
    set: async () => undefined,
    increment: async () => 1,
  };

  return {
    ...base,
    ...overrides,
  } as unknown as CacheStore;
}

const FULL_FILTERS = {
  sideFilter: 'left',
  lineFilter: 'all',
  euPlateFilter: 'no',
  cameraGenFilter: 'all',
  coverageYearFilter: 'all',
  carColorFilter: 'all',
  vehicleTypeFilter: 'all',
} as const;

describe('SavedFiltersService', () => {
  it('createSavedFilter defaults isPublic to false', async () => {
    const createdAt = makeDate('2026-01-01T00:00:00.000Z');
    const updatedAt = makeDate('2026-01-02T00:00:00.000Z');

    let capturedIsPublic: boolean | undefined;

    const prismaMock = {
      savedFilter: {
        create: async (input: {
          data: {
            userId: string;
            name: string;
            description?: string;
            filters: Record<string, unknown>;
            isPublic: boolean;
          };
        }) => {
          capturedIsPublic = input.data.isPublic;
          return {
            id: 'sf-1',
            userId: input.data.userId,
            name: input.data.name,
            description: input.data.description ?? null,
            filters: input.data.filters,
            isPublic: input.data.isPublic,
            views: 0,
            createdAt,
            updatedAt,
          };
        },
        findMany: async () => [],
        count: async () => 0,
        findUnique: async () => null,
        update: async () => {
          throw new Error('update should not be called');
        },
        delete: async () => {
          throw new Error('delete should not be called');
        },
      },
    };

    const cacheStoreMock = makeCacheStoreMock();
    const service = new SavedFiltersService(prismaMock as unknown as PrismaService, cacheStoreMock);

    const result = await service.createSavedFilter('user-1', {
      name: 'Starter',
      filters: { ...FULL_FILTERS },
    });

    assert.equal(capturedIsPublic, false);
    assert.equal(result.id, 'sf-1');
    assert.equal(result.isPublic, false);
  });

  it('listPublicSavedFilters returns paginated result with parsed page and limit', async () => {
    const createdAt = makeDate('2026-01-01T00:00:00.000Z');
    const updatedAt = makeDate('2026-01-01T00:00:00.000Z');

    let capturedSkip: number | undefined;
    let capturedTake: number | undefined;

    const prismaMock = {
      savedFilter: {
        create: async () => {
          throw new Error('create should not be called');
        },
        findMany: async (input: {
          where: { isPublic: true };
          orderBy: Array<Record<string, 'asc' | 'desc'>>;
          skip: number;
          take: number;
        }) => {
          capturedSkip = input.skip;
          capturedTake = input.take;
          return [
            {
              id: 'sf-public',
              userId: 'user-1',
              name: 'Public Filter',
              description: null,
              filters: { cameraGenFilter: '4' },
              isPublic: true,
              views: 20,
              createdAt,
              updatedAt,
            },
          ];
        },
        count: async () => 7,
        findUnique: async () => null,
        update: async () => {
          throw new Error('update should not be called');
        },
        delete: async () => {
          throw new Error('delete should not be called');
        },
      },
    };

    const cacheStoreMock = makeCacheStoreMock();
    const service = new SavedFiltersService(prismaMock as unknown as PrismaService, cacheStoreMock);

    const result = await service.listPublicSavedFilters('2', '3');

    assert.equal(capturedSkip, 3);
    assert.equal(capturedTake, 3);
    assert.equal(result.page, 2);
    assert.equal(result.limit, 3);
    assert.equal(result.total, 7);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].id, 'sf-public');
  });

  it('getSavedFilterById throws NotFoundException when missing', async () => {
    const prismaMock = {
      savedFilter: {
        create: async () => {
          throw new Error('create should not be called');
        },
        findMany: async () => [],
        count: async () => 0,
        findUnique: async () => null,
        update: async () => {
          throw new Error('update should not be called');
        },
        delete: async () => {
          throw new Error('delete should not be called');
        },
      },
    };

    const cacheStoreMock = makeCacheStoreMock();
    const service = new SavedFiltersService(prismaMock as unknown as PrismaService, cacheStoreMock);

    await assert.rejects(
      service.getSavedFilterById('missing-id', 'user-1', UserRole.USER),
      (error: unknown) =>
        error instanceof NotFoundException && error.message === 'Saved filter not found'
    );
  });

  it('deleteSavedFilter returns deletion marker for existing entity', async () => {
    const prismaMock = {
      savedFilter: {
        create: async () => {
          throw new Error('create should not be called');
        },
        findMany: async () => [],
        count: async () => 0,
        findUnique: async () => ({ id: 'sf-1', userId: 'user-1' }),
        update: async () => {
          throw new Error('update should not be called');
        },
        delete: async () => ({ id: 'sf-1' }),
      },
    };

    const cacheStoreMock = makeCacheStoreMock();
    const service = new SavedFiltersService(prismaMock as unknown as PrismaService, cacheStoreMock);

    const result = await service.deleteSavedFilter('sf-1', 'user-1', UserRole.USER);

    assert.deepEqual(result, { id: 'sf-1', deleted: true });
  });

  it('deleteSavedFilter throws ForbiddenException when non-owner tries to delete', async () => {
    const prismaMock = {
      savedFilter: {
        create: async () => {
          throw new Error('create should not be called');
        },
        findMany: async () => [],
        count: async () => 0,
        findUnique: async () => ({ id: 'sf-1', userId: 'owner-1' }),
        update: async () => {
          throw new Error('update should not be called');
        },
        delete: async () => {
          throw new Error('delete should not be called');
        },
      },
    };

    const cacheStoreMock = makeCacheStoreMock();
    const service = new SavedFiltersService(prismaMock as unknown as PrismaService, cacheStoreMock);

    await assert.rejects(
      service.deleteSavedFilter('sf-1', 'other-user', UserRole.USER),
      (error: unknown) =>
        error instanceof ForbiddenException &&
        error.message === 'You do not have access to this saved filter'
    );
  });

  it('listPublicSavedFilters returns cached payload without querying prisma', async () => {
    const cachedPayload = JSON.stringify({
      items: [
        {
          id: 'cached-1',
          userId: 'user-1',
          name: 'Cached',
          filters: { sideFilter: 'left' },
          isPublic: true,
          views: 10,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });

    let findManyCalled = false;

    const prismaMock = {
      savedFilter: {
        create: async () => {
          throw new Error('create should not be called');
        },
        findMany: async () => {
          findManyCalled = true;
          return [];
        },
        count: async () => 0,
        findUnique: async () => null,
        update: async () => {
          throw new Error('update should not be called');
        },
        delete: async () => {
          throw new Error('delete should not be called');
        },
      },
    };

    const cacheStoreMock = makeCacheStoreMock({
      get: async (key: string) => {
        if (key === 'cache:saved-filters:public:version') {
          return '0';
        }

        if (key === 'cache:saved-filters:public:v0:p1:l20') {
          return cachedPayload;
        }

        return undefined;
      },
    });

    const service = new SavedFiltersService(prismaMock as unknown as PrismaService, cacheStoreMock);

    const result = await service.listPublicSavedFilters();

    assert.equal(findManyCalled, false);
    assert.equal(result.total, 1);
    assert.equal(result.items[0].id, 'cached-1');
    assert.equal(result.items[0].createdAt.toISOString(), '2026-01-01T00:00:00.000Z');
  });

  it('createSavedFilter bumps public cache version', async () => {
    let incrementCalled = false;

    const prismaMock = {
      savedFilter: {
        create: async (input: {
          data: {
            userId: string;
            name: string;
            description?: string;
            filters: Record<string, unknown>;
            isPublic: boolean;
          };
        }) => ({
          id: 'sf-cache',
          userId: input.data.userId,
          name: input.data.name,
          description: input.data.description ?? null,
          filters: input.data.filters,
          isPublic: input.data.isPublic,
          views: 0,
          createdAt: makeDate('2026-01-01T00:00:00.000Z'),
          updatedAt: makeDate('2026-01-01T00:00:00.000Z'),
        }),
        findMany: async () => [],
        count: async () => 0,
        findUnique: async () => null,
        update: async () => {
          throw new Error('update should not be called');
        },
        delete: async () => {
          throw new Error('delete should not be called');
        },
      },
    };

    const cacheStoreMock = makeCacheStoreMock({
      increment: async (key: string) => {
        if (key === 'cache:saved-filters:public:version') {
          incrementCalled = true;
        }

        return 1;
      },
    });

    const service = new SavedFiltersService(prismaMock as unknown as PrismaService, cacheStoreMock);

    await service.createSavedFilter('user-1', {
      name: 'Invalidate Cache',
      filters: { ...FULL_FILTERS },
      isPublic: true,
    });

    assert.equal(incrementCalled, true);
  });

  it('listOwnSavedFilters always scopes to the requesting user', async () => {
    let capturedWhere: { userId?: string } | undefined;

    const prismaMock = {
      savedFilter: {
        create: async () => {
          throw new Error('create should not be called');
        },
        findMany: async (input: { where?: { userId?: string } }) => {
          capturedWhere = input.where;
          return [
            {
              id: 'sf-own',
              userId: 'user-1',
              name: 'Mine',
              description: null,
              filters: { ...FULL_FILTERS },
              isPublic: false,
              views: 0,
              createdAt: makeDate('2026-01-01T00:00:00.000Z'),
              updatedAt: makeDate('2026-01-01T00:00:00.000Z'),
            },
          ];
        },
        count: async () => 0,
        findUnique: async () => null,
        update: async () => {
          throw new Error('update should not be called');
        },
        delete: async () => {
          throw new Error('delete should not be called');
        },
      },
    };

    const cacheStoreMock = makeCacheStoreMock();
    const service = new SavedFiltersService(prismaMock as unknown as PrismaService, cacheStoreMock);

    const result = await service.listOwnSavedFilters('user-1');

    assert.deepEqual(capturedWhere, { userId: 'user-1' });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'sf-own');
  });
});
