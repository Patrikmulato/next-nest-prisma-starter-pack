import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { UserRole } from '../../../generated/prisma/index.js';
import { AppModule } from '../../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

type MockUser = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

describe('UsersController RBAC (e2e)', () => {
  let app: NestFastifyApplication;
  let adminAccessToken: string;
  let userAccessToken: string;

  const mockUsers: MockUser[] = [
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
      findMany: async () => mockUsers,
      delete: async (input: { where: { id: string } }) => {
        const index = mockUsers.findIndex((user) => user.id === input.where.id);
        if (index < 0) {
          throw new Error('delete target not found');
        }
        const [removed] = mockUsers.splice(index, 1);
        return removed;
      },
      create: async (input: {
        data: { email: string; role: UserRole };
        select: { id: true; email: true; role: true; createdAt: true; updatedAt: true };
      }) => ({
        id: 'created-user',
        email: input.data.email,
        role: input.data.role,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        updatedAt: new Date('2026-01-03T00:00:00.000Z'),
      }),
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

  it('GET /api/users returns 403 for non-admin users', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: {
        authorization: `Bearer ${userAccessToken}`,
      },
    });

    assert.equal(response.statusCode, 403, response.body);
  });

  it('GET /api/users returns 200 for admins', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    assert.equal(response.statusCode, 200, response.body);
    const body = response.json();
    assert.equal(Array.isArray(body), true);
    assert.equal(body.length, 2);
  });

  it('GET /api/users/:id returns 403 for non-admin users', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/users/user-1',
      headers: {
        authorization: `Bearer ${userAccessToken}`,
      },
    });

    assert.equal(response.statusCode, 403, response.body);
  });

  it('GET /api/users/:id returns 200 for admins', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/users/user-1',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    assert.equal(response.statusCode, 200, response.body);
    const body = response.json();
    assert.equal(body.id, 'user-1');
    assert.equal(body.email, 'user@example.com');
    assert.equal(body.role, 'USER');
  });

  it('POST /api/users returns 403 for non-admin users with a valid token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: {
        authorization: `Bearer ${userAccessToken}`,
      },
      payload: {
        email: 'new-user@example.com',
        password: 'super-secret-123',
      },
    });

    assert.equal(response.statusCode, 403, response.body);
  });

  it('POST /api/users returns 401 without token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: {
        email: 'new-user@example.com',
        password: 'super-secret-123',
      },
    });

    assert.equal(response.statusCode, 401, response.body);
  });

  it('POST /api/users returns 400 for a malformed email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
      payload: {
        email: 'not-an-email',
        password: 'super-secret-123',
      },
    });

    assert.equal(response.statusCode, 400, response.body);
  });

  it('POST /api/users returns 400 for an invalid role', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
      payload: {
        email: 'new-role-user@example.com',
        password: 'super-secret-123',
        role: 'SUPERUSER',
      },
    });

    assert.equal(response.statusCode, 400, response.body);
  });

  it('DELETE /api/users/:id returns 403 for non-admin users', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/users/admin-1',
      headers: {
        authorization: `Bearer ${userAccessToken}`,
      },
    });

    assert.equal(response.statusCode, 403, response.body);
  });

  it('DELETE /api/users/:id returns 400 when admin attempts to delete self', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/users/admin-1',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    assert.equal(response.statusCode, 400, response.body);
  });

  it('DELETE /api/users/:id returns 200 for admins deleting another user', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/users/user-1',
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    assert.equal(response.statusCode, 200, response.body);
    const body = response.json();
    assert.deepEqual(body, {
      id: 'user-1',
      deleted: true,
    });
  });
});
