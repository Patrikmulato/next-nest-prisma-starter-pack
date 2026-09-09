import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RateLimitStore } from '../../common/rate-limit/rate-limit.store.js';

type MockSavedFilter = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  filters: Record<string, unknown>;
  isPublic: boolean;
  views: number;
  createdAt: Date;
  updatedAt: Date;
};

describe('SavedFiltersController authorization (e2e)', () => {
  let app: NestFastifyApplication;
  let ownerAccessToken: string;
  let otherUserAccessToken: string;
  let adminAccessToken: string;

  const savedFilters = new Map<string, MockSavedFilter>();
  let nextId = 1;
  const rateLimitHits = new Map<string, number>();

  const prismaMock = {
    user: {
      findUnique: async () => null,
      findMany: async () => [],
      create: async () => {
        throw new Error('user.create should not be called');
      },
      update: async () => {
        throw new Error('user.update should not be called');
      },
    },
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
        const savedFilter: MockSavedFilter = {
          id: `sf-${nextId++}`,
          userId: input.data.userId,
          name: input.data.name,
          description: input.data.description ?? null,
          filters: input.data.filters,
          isPublic: input.data.isPublic,
          views: 0,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        };

        savedFilters.set(savedFilter.id, savedFilter);
        return savedFilter;
      },
      findMany: async (input?: {
        where?: { userId?: string; isPublic?: boolean };
        skip?: number;
        take?: number;
      }) => {
        let results = Array.from(savedFilters.values());

        if (input?.where?.userId) {
          results = results.filter((savedFilter) => savedFilter.userId === input.where?.userId);
        }

        if (input?.where?.isPublic === true) {
          results = results.filter((savedFilter) => savedFilter.isPublic);
        }

        const skip = input?.skip ?? 0;
        const take = input?.take ?? results.length;
        return results.slice(skip, skip + take);
      },
      count: async (input?: { where?: { isPublic?: boolean } }) => {
        if (input?.where?.isPublic === true) {
          return Array.from(savedFilters.values()).filter((savedFilter) => savedFilter.isPublic)
            .length;
        }

        return savedFilters.size;
      },
      findUnique: async (input: { where: { id: string } }) => {
        return savedFilters.get(input.where.id) ?? null;
      },
      update: async (input: {
        where: { id: string };
        data: {
          name?: string;
          description?: string;
          filters?: Record<string, unknown>;
          isPublic?: boolean;
        };
      }) => {
        const existing = savedFilters.get(input.where.id);
        if (!existing) {
          throw new Error('saved filter not found in mock store');
        }

        const updated: MockSavedFilter = {
          ...existing,
          ...input.data,
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        };
        savedFilters.set(updated.id, updated);
        return updated;
      },
      delete: async (input: { where: { id: string } }) => {
        const existing = savedFilters.get(input.where.id);
        if (!existing) {
          throw new Error('saved filter not found in mock store');
        }

        savedFilters.delete(input.where.id);
        return existing;
      },
    },
  };

  before(async () => {
    savedFilters.clear();
    savedFilters.set('owner-private', {
      id: 'owner-private',
      userId: 'owner-1',
      name: 'Owner Private',
      description: null,
      filters: { sideFilter: 'left' },
      isPublic: false,
      views: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    savedFilters.set('other-private', {
      id: 'other-private',
      userId: 'user-2',
      name: 'Other Private',
      description: null,
      filters: { sideFilter: 'right' },
      isPublic: false,
      views: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    savedFilters.set('other-public', {
      id: 'other-public',
      userId: 'user-2',
      name: 'Other Public',
      description: null,
      filters: { sideFilter: 'right' },
      isPublic: true,
      views: 5,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    nextId = 100;
    rateLimitHits.clear();

    const rateLimitStoreMock = {
      hit: async (key: string, maxRequests: number) => {
        const nextHit = (rateLimitHits.get(key) ?? 0) + 1;
        rateLimitHits.set(key, nextHit);

        const allowed = nextHit <= maxRequests;

        return {
          allowed,
          limit: maxRequests,
          remaining: Math.max(0, maxRequests - nextHit),
          retryAfterSeconds: 60,
        };
      },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RateLimitStore)
      .useValue(rateLimitStoreMock)
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const jwtService = app.get(JwtService);
    ownerAccessToken = await jwtService.signAsync({
      sub: 'owner-1',
      email: 'owner@example.com',
      role: 'USER',
    });
    otherUserAccessToken = await jwtService.signAsync({
      sub: 'user-2',
      email: 'other@example.com',
      role: 'USER',
    });
    adminAccessToken = await jwtService.signAsync({
      sub: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN',
    });
  });

  after(async () => {
    await app.close();
  });

  it('POST /api/saved-filters returns 401 without token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/saved-filters',
      payload: {
        name: 'Unauthenticated',
        filters: { sideFilter: 'left' },
      },
    });

    assert.equal(response.statusCode, 401, response.body);
  });

  it('POST /api/saved-filters returns 400 when filters is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/saved-filters',
      headers: {
        authorization: `Bearer ${ownerAccessToken}`,
      },
      payload: {
        name: 'Missing Filters',
      },
    });

    assert.equal(response.statusCode, 400, response.body);
  });

  it('POST /api/saved-filters returns 400 when filters is incomplete', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/saved-filters',
      headers: {
        authorization: `Bearer ${ownerAccessToken}`,
      },
      payload: {
        name: 'Incomplete Filters',
        filters: { sideFilter: 'left' },
      },
    });

    assert.equal(response.statusCode, 400, response.body);
  });

  it('POST /api/saved-filters creates a filter owned by the authenticated user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/saved-filters',
      headers: {
        authorization: `Bearer ${ownerAccessToken}`,
      },
      payload: {
        name: 'Owner Created',
        filters: {
          sideFilter: 'left',
          lineFilter: 'all',
          euPlateFilter: 'no',
          cameraGenFilter: 'all',
          coverageYearFilter: 'all',
          carColorFilter: 'all',
          vehicleTypeFilter: 'all',
        },
        isPublic: false,
      },
    });

    assert.equal(response.statusCode, 201, response.body);
    const body = response.json();
    assert.equal(body.userId, 'owner-1');
    assert.equal(body.name, 'Owner Created');
  });

  it('GET /api/saved-filters returns only the requester filters for normal users', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/saved-filters',
      headers: {
        authorization: `Bearer ${ownerAccessToken}`,
      },
    });

    assert.equal(response.statusCode, 200, response.body);
    const body = response.json();
    assert.equal(Array.isArray(body), true);
    assert.equal(
      body.every((savedFilter: { userId: string }) => savedFilter.userId === 'owner-1'),
      true
    );
  });

  it('GET /api/saved-filters/:id returns 403 for non-owner private filter access', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/saved-filters/owner-private',
      headers: {
        authorization: `Bearer ${otherUserAccessToken}`,
      },
    });

    assert.equal(response.statusCode, 403, response.body);
  });

  it('PUT /api/saved-filters/:id allows admins to update another user filter', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/saved-filters/other-private',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
      payload: {
        name: 'Admin Updated',
      },
    });

    assert.equal(response.statusCode, 200, response.body);
    const body = response.json();
    assert.equal(body.name, 'Admin Updated');
  });

  it('DELETE /api/saved-filters/:id returns 403 for non-owner and 200 for admin', async () => {
    const denied = await app.inject({
      method: 'DELETE',
      url: '/api/saved-filters/owner-private',
      headers: {
        authorization: `Bearer ${otherUserAccessToken}`,
      },
    });

    assert.equal(denied.statusCode, 403, denied.body);

    const allowed = await app.inject({
      method: 'DELETE',
      url: '/api/saved-filters/owner-private',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    assert.equal(allowed.statusCode, 200, allowed.body);
    const body = allowed.json();
    assert.deepEqual(body, { id: 'owner-private', deleted: true });
  });

  it('GET /api/saved-filters/public returns 429 after exceeding configured threshold', async () => {
    for (let index = 0; index < 60; index += 1) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/saved-filters/public',
      });

      assert.equal(response.statusCode, 200, response.body);
    }

    const limited = await app.inject({
      method: 'GET',
      url: '/api/saved-filters/public',
    });

    assert.equal(limited.statusCode, 429, limited.body);
  });
});
