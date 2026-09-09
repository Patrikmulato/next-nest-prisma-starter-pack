import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { UserRole } from '../../../generated/prisma/index.js';
import { AppModule } from '../../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('UsefulMapCategoriesController RBAC (e2e)', () => {
  let app: NestFastifyApplication;
  let adminAccessToken: string;
  let userAccessToken: string;

  const mockUsers = [
    {
      id: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    },
    {
      id: 'user-1',
      email: 'user@example.com',
      role: UserRole.USER,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ];

  const prismaMock = {
    user: {
      findUnique: async (input: { where: { id?: string; email?: string } }) => {
        const { id, email } = input.where;
        return mockUsers.find((user) => user.id === id || user.email === email) ?? null;
      },
    },
    usefulMapCategory: {
      findMany: async () => [],
      findFirst: async () => null,
      findUnique: async () => null,
      create: async (input: { data: { slug: string; label: string } }) => ({
        id: 'cat-1',
        slug: input.data.slug,
        label: input.data.label,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        updatedAt: new Date('2026-01-03T00:00:00.000Z'),
      }),
    },
    usefulMap: {
      count: async () => 0,
    },
  };

  before(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
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
    adminAccessToken = await jwtService.signAsync({
      sub: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN',
    });
    userAccessToken = await jwtService.signAsync({
      sub: 'user-1',
      email: 'user@example.com',
      role: 'USER',
    });
  });

  after(async () => {
    await app.close();
  });

  it('no Bearer token returns 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/useful-map-categories',
    });

    assert.equal(response.statusCode, 401, response.body);
  });

  it('authenticated non-admin returns 403', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/useful-map-categories',
      headers: {
        authorization: `Bearer ${userAccessToken}`,
      },
    });

    assert.equal(response.statusCode, 403, response.body);
  });

  it("POST with slug='Not A Slug' returns 400", async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/useful-map-categories',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
      payload: {
        slug: 'Not A Slug',
        label: 'Valid Label',
      },
    });

    assert.equal(response.statusCode, 400, response.body);
  });

  it('POST with unknown extra field returns 400 (forbidNonWhitelisted)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/useful-map-categories',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
      payload: {
        slug: 'valid-slug',
        label: 'Valid Label',
        extraField: 'should-fail',
      },
    });

    assert.equal(response.statusCode, 400, response.body);
  });

  it('PUT carrying slug returns 400 (slug is immutable)', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/useful-map-categories/cat-1',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
      payload: {
        label: 'New Label',
        slug: 'new-slug',
      },
    });

    assert.equal(response.statusCode, 400, response.body);
  });
});
