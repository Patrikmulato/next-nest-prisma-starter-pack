import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/index.js';
import { UsefulMapCategoriesService } from './useful-map-categories.service.js';
import type { LoggerService } from '../../common/logger/logger.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { UsefulMapsService } from '../useful-maps/useful-maps.service.js';

function makeLoggerMock(): LoggerService {
  return {
    log: async () => undefined,
    warn: async () => undefined,
    error: async () => undefined,
  } as unknown as LoggerService;
}

function makeDate(value: string): Date {
  return new Date(value);
}

describe('UsefulMapCategoriesService', () => {
  it('createCategory trims label and persists the given slug', async () => {
    const createdAt = makeDate('2026-01-01T00:00:00.000Z');
    const updatedAt = makeDate('2026-01-02T00:00:00.000Z');

    const prismaMock = {
      usefulMapCategory: {
        findFirst: async () => null,
        create: async (input: { data: { slug: string; label: string } }) => ({
          id: 'cat-1',
          slug: input.data.slug,
          label: input.data.label,
          createdAt,
          updatedAt,
        }),
      },
    };

    const usefulMapsServiceMock = {} as unknown as UsefulMapsService;
    const loggerMock = makeLoggerMock();
    const service = new UsefulMapCategoriesService(
      prismaMock as unknown as PrismaService,
      usefulMapsServiceMock,
      loggerMock
    );

    const result = await service.createCategory('user-1', {
      slug: 'test-slug',
      label: '  Test Label  ',
    });

    assert.equal(result.label, 'Test Label');
    assert.equal(result.slug, 'test-slug');
    assert.equal(result.mapCount, 0);
  });

  it('duplicate slug returns ConflictException', async () => {
    const prismaMock = {
      usefulMapCategory: {
        findFirst: async () => ({ id: 'cat-existing' }),
      },
    };

    const usefulMapsServiceMock = {} as unknown as UsefulMapsService;
    const loggerMock = makeLoggerMock();
    const service = new UsefulMapCategoriesService(
      prismaMock as unknown as PrismaService,
      usefulMapsServiceMock,
      loggerMock
    );

    await assert.rejects(
      () =>
        service.createCategory('user-1', {
          slug: 'existing-slug',
          label: 'New Label',
        }),
      ConflictException
    );
  });

  it('duplicate label returns ConflictException', async () => {
    const prismaMock = {
      usefulMapCategory: {
        findFirst: async () => ({ id: 'cat-existing' }),
      },
    };

    const usefulMapsServiceMock = {} as unknown as UsefulMapsService;
    const loggerMock = makeLoggerMock();
    const service = new UsefulMapCategoriesService(
      prismaMock as unknown as PrismaService,
      usefulMapsServiceMock,
      loggerMock
    );

    await assert.rejects(
      () =>
        service.createCategory('user-1', {
          slug: 'new-slug',
          label: 'Existing Label',
        }),
      ConflictException
    );
  });

  it('label differing only in case returns ConflictException', async () => {
    const prismaMock = {
      usefulMapCategory: {
        findFirst: async () => ({ id: 'cat-existing' }),
      },
    };

    const usefulMapsServiceMock = {} as unknown as UsefulMapsService;
    const loggerMock = makeLoggerMock();
    const service = new UsefulMapCategoriesService(
      prismaMock as unknown as PrismaService,
      usefulMapsServiceMock,
      loggerMock
    );

    await assert.rejects(
      () =>
        service.createCategory('user-1', {
          slug: 'new-slug',
          label: 'bollards',
        }),
      ConflictException
    );
  });

  it('Prisma P2002 from create is surfaced as ConflictException', async () => {
    const prismaMock = {
      usefulMapCategory: {
        findFirst: async () => null,
        create: async () => {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: '1.0',
          });
        },
      },
    };

    const usefulMapsServiceMock = {} as unknown as UsefulMapsService;
    const loggerMock = makeLoggerMock();
    const service = new UsefulMapCategoriesService(
      prismaMock as unknown as PrismaService,
      usefulMapsServiceMock,
      loggerMock
    );

    await assert.rejects(
      () =>
        service.createCategory('user-1', {
          slug: 'test-slug',
          label: 'Test Label',
        }),
      ConflictException
    );
  });

  it('updateCategory on missing id returns NotFoundException', async () => {
    const prismaMock = {
      usefulMapCategory: {
        findUnique: async () => null,
      },
    };

    const usefulMapsServiceMock = {} as unknown as UsefulMapsService;
    const loggerMock = makeLoggerMock();
    const service = new UsefulMapCategoriesService(
      prismaMock as unknown as PrismaService,
      usefulMapsServiceMock,
      loggerMock
    );

    await assert.rejects(
      () => service.updateCategory('cat-missing', 'user-1', { label: 'New' }),
      NotFoundException
    );
  });

  it('updateCategory calls invalidatePublicCache on label change', async () => {
    const createdAt = makeDate('2026-01-01T00:00:00.000Z');
    const updatedAt = makeDate('2026-01-02T00:00:00.000Z');

    let cacheInvalidateCalls = 0;

    const prismaMock = {
      usefulMapCategory: {
        findUnique: async () => ({
          id: 'cat-1',
          slug: 'test-slug',
          label: 'Old Label',
          createdAt,
          updatedAt,
          _count: { usefulMaps: 2 },
        }),
        findFirst: async () => null,
        update: async (input: { where: { id: string }; data: { label: string } }) => ({
          id: input.where.id,
          slug: 'test-slug',
          label: input.data.label,
          createdAt,
          updatedAt,
        }),
      },
    };

    const usefulMapsServiceMock = {
      invalidatePublicCache: async () => {
        cacheInvalidateCalls += 1;
      },
    } as unknown as UsefulMapsService;
    const loggerMock = makeLoggerMock();
    const service = new UsefulMapCategoriesService(
      prismaMock as unknown as PrismaService,
      usefulMapsServiceMock,
      loggerMock
    );

    await service.updateCategory('cat-1', 'user-1', { label: 'New Label' });

    assert.equal(cacheInvalidateCalls, 1);
  });

  it('updateCategory with unchanged label does not invalidate cache', async () => {
    const createdAt = makeDate('2026-01-01T00:00:00.000Z');
    const updatedAt = makeDate('2026-01-02T00:00:00.000Z');

    let cacheInvalidateCalls = 0;

    const prismaMock = {
      usefulMapCategory: {
        findUnique: async () => ({
          id: 'cat-1',
          slug: 'test-slug',
          label: 'Test Label',
          createdAt,
          updatedAt,
          _count: { usefulMaps: 2 },
        }),
      },
    };

    const usefulMapsServiceMock = {
      invalidatePublicCache: async () => {
        cacheInvalidateCalls += 1;
      },
    } as unknown as UsefulMapsService;
    const loggerMock = makeLoggerMock();
    const service = new UsefulMapCategoriesService(
      prismaMock as unknown as PrismaService,
      usefulMapsServiceMock,
      loggerMock
    );

    await service.updateCategory('cat-1', 'user-1', { label: 'Test Label' });

    assert.equal(cacheInvalidateCalls, 0);
  });

  it('updateCategory excludes own id from conflict check', async () => {
    const createdAt = makeDate('2026-01-01T00:00:00.000Z');
    const updatedAt = makeDate('2026-01-02T00:00:00.000Z');

    let findFirstWhereArg: unknown;

    const prismaMock = {
      usefulMapCategory: {
        findUnique: async () => ({
          id: 'cat-1',
          slug: 'us',
          label: 'us',
          createdAt,
          updatedAt,
          _count: { usefulMaps: 0 },
        }),
        findFirst: async (input: { where: unknown }) => {
          findFirstWhereArg = input.where;
          return null;
        },
        update: async (input: { where: { id: string }; data: { label: string } }) => ({
          id: input.where.id,
          slug: 'us',
          label: input.data.label,
          createdAt,
          updatedAt,
        }),
      },
    };

    const usefulMapsServiceMock = {
      invalidatePublicCache: async () => undefined,
    } as unknown as UsefulMapsService;
    const loggerMock = makeLoggerMock();
    const service = new UsefulMapCategoriesService(
      prismaMock as unknown as PrismaService,
      usefulMapsServiceMock,
      loggerMock
    );

    await service.updateCategory('cat-1', 'user-1', { label: 'US' });

    // Verify that findFirst was called with id exclusion
    assert.ok(
      findFirstWhereArg && typeof findFirstWhereArg === 'object' && 'id' in findFirstWhereArg
    );
  });

  it('deleteCategory with mapCount > 0 returns ConflictException', async () => {
    const prismaMock = {
      usefulMapCategory: {
        findUnique: async () => ({
          id: 'cat-1',
          slug: 'test-slug',
          label: 'Test Label',
          _count: { usefulMaps: 5 },
        }),
      },
    };

    const usefulMapsServiceMock = {} as unknown as UsefulMapsService;
    const loggerMock = makeLoggerMock();
    const service = new UsefulMapCategoriesService(
      prismaMock as unknown as PrismaService,
      usefulMapsServiceMock,
      loggerMock
    );

    await assert.rejects(() => service.deleteCategory('cat-1', 'user-1'), ConflictException);
  });

  it('deleteCategory with no maps deletes and invalidates cache', async () => {
    let deleteCalls = 0;
    let cacheInvalidateCalls = 0;

    const prismaMock = {
      usefulMapCategory: {
        findUnique: async () => ({
          id: 'cat-1',
          slug: 'test-slug',
          label: 'Test Label',
          _count: { usefulMaps: 0 },
        }),
        delete: async () => {
          deleteCalls += 1;
        },
      },
    };

    const usefulMapsServiceMock = {
      invalidatePublicCache: async () => {
        cacheInvalidateCalls += 1;
      },
    } as unknown as UsefulMapsService;
    const loggerMock = makeLoggerMock();
    const service = new UsefulMapCategoriesService(
      prismaMock as unknown as PrismaService,
      usefulMapsServiceMock,
      loggerMock
    );

    const result = await service.deleteCategory('cat-1', 'user-1');

    assert.equal(deleteCalls, 1);
    assert.equal(cacheInvalidateCalls, 1);
    assert.deepEqual(result, { id: 'cat-1', deleted: true });
  });

  it('listCategories maps _count.usefulMaps to mapCount and returns label-sorted', async () => {
    const prismaMock = {
      usefulMapCategory: {
        findMany: async () => [
          {
            id: 'cat-3',
            slug: 'zebra',
            label: 'Zebra',
            createdAt: makeDate('2026-01-01T00:00:00.000Z'),
            updatedAt: makeDate('2026-01-02T00:00:00.000Z'),
            _count: { usefulMaps: 1 },
          },
          {
            id: 'cat-1',
            slug: 'apple',
            label: 'Apple',
            createdAt: makeDate('2026-01-01T00:00:00.000Z'),
            updatedAt: makeDate('2026-01-02T00:00:00.000Z'),
            _count: { usefulMaps: 5 },
          },
          {
            id: 'cat-2',
            slug: 'banana',
            label: 'Banana',
            createdAt: makeDate('2026-01-01T00:00:00.000Z'),
            updatedAt: makeDate('2026-01-02T00:00:00.000Z'),
            _count: { usefulMaps: 0 },
          },
        ],
      },
    };

    const usefulMapsServiceMock = {} as unknown as UsefulMapsService;
    const loggerMock = makeLoggerMock();
    const service = new UsefulMapCategoriesService(
      prismaMock as unknown as PrismaService,
      usefulMapsServiceMock,
      loggerMock
    );

    const result = await service.listCategories();

    assert.equal(result.length, 3);
    assert.equal(result[0].label, 'Apple');
    assert.equal(result[0].mapCount, 5);
    assert.equal(result[1].label, 'Banana');
    assert.equal(result[1].mapCount, 0);
    assert.equal(result[2].label, 'Zebra');
    assert.equal(result[2].mapCount, 1);
  });
});
