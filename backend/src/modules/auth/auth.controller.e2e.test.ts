import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { Test } from '@nestjs/testing';
import { UserRole } from '../../../generated/prisma/index.js';
import { AppModule } from '../../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

type MockUser = {
  id: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  refreshTokenHash: string | null;
};

function extractRefreshCookie(setCookieHeader: string | string[] | undefined): string {
  const rawList = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];

  const refreshEntry = rawList.find((entry) => entry.startsWith('refresh_token='));
  if (!refreshEntry) {
    throw new Error('Missing refresh_token set-cookie header');
  }

  const pair = refreshEntry.split(';')[0];
  if (!pair) {
    throw new Error('Invalid set-cookie header format');
  }

  return pair;
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

describe('AuthController (e2e)', () => {
  let app: NestFastifyApplication;
  const users = new Map<string, MockUser>();
  let nextId = 1;

  const prismaMock = {
    user: {
      findUnique: async (input: { where: { id?: string; email?: string } }) => {
        const { id, email } = input.where;

        if (id) {
          return users.get(id) ?? null;
        }

        if (email) {
          for (const user of users.values()) {
            if (user.email === email) {
              return user;
            }
          }
        }

        return null;
      },
      create: async (input: {
        data: { email: string; passwordHash: string; role?: UserRole };
        select: {
          id?: true;
          email?: true;
          role?: true;
          passwordHash?: true;
          refreshTokenHash?: true;
        };
      }) => {
        const user: MockUser = {
          id: `mock-user-${nextId++}`,
          email: input.data.email,
          role: input.data.role ?? UserRole.USER,
          passwordHash: input.data.passwordHash,
          refreshTokenHash: null,
        };

        users.set(user.id, user);

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          passwordHash: user.passwordHash,
          refreshTokenHash: user.refreshTokenHash,
        };
      },
      update: async (input: {
        where: { id: string };
        data: { refreshTokenHash: string | null };
      }) => {
        const user = users.get(input.where.id);
        if (!user) {
          throw new Error('User not found in mock store');
        }

        user.refreshTokenHash = input.data.refreshTokenHash;
        users.set(user.id, user);

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          passwordHash: user.passwordHash,
          refreshTokenHash: user.refreshTokenHash,
        };
      },
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await app.register(fastifyCookie as any);
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
  });

  after(async () => {
    await app.close();
  });

  it('register + login + me + refresh + logout flow works', async () => {
    const email = uniqueEmail('auth-flow');
    const password = 'super-secret-123';

    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password,
      },
    });

    assert.equal(registerRes.statusCode, 201, registerRes.body);
    const registerBody = registerRes.json();
    assert.equal(typeof registerBody.accessToken, 'string');
    assert.equal('refreshToken' in registerBody, false);
    assert.equal(registerBody.user.email, email);
    assert.equal(registerBody.user.role, 'USER');
    assert.equal('password' in registerBody, false);
    assert.equal('passwordHash' in registerBody.user, false);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email,
        password,
      },
    });

    assert.equal(loginRes.statusCode, 201, loginRes.body);
    const loginBody = loginRes.json();
    assert.equal(typeof loginBody.accessToken, 'string');
    assert.equal('refreshToken' in loginBody, false);

    const refreshCookie = extractRefreshCookie(loginRes.headers['set-cookie']);

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${loginBody.accessToken}`,
      },
    });

    assert.equal(meRes.statusCode, 200, meRes.body);
    const meBody = meRes.json();

    assert.equal(meBody.email, email);
    assert.equal(meBody.role, 'USER');
    assert.equal(typeof meBody.id, 'string');

    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: {
        origin: 'http://localhost:3000',
        cookie: refreshCookie,
      },
    });

    assert.equal(refreshRes.statusCode, 201, refreshRes.body);
    const refreshBody = refreshRes.json();
    assert.equal(typeof refreshBody.accessToken, 'string');
    assert.equal('refreshToken' in refreshBody, false);

    const rotatedRefreshCookie = extractRefreshCookie(refreshRes.headers['set-cookie']);

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        origin: 'http://localhost:3000',
        cookie: rotatedRefreshCookie,
      },
    });

    assert.equal(logoutRes.statusCode, 201, logoutRes.body);
    const logoutBody = logoutRes.json();
    assert.equal(logoutBody.revoked, true);
    const clearedCookieHeader = Array.isArray(logoutRes.headers['set-cookie'])
      ? logoutRes.headers['set-cookie'].join('; ')
      : (logoutRes.headers['set-cookie'] ?? '');
    assert.match(clearedCookieHeader, /refresh_token=;/);
    assert.match(clearedCookieHeader, /Path=\/api\/auth/);
    assert.match(clearedCookieHeader, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);

    const refreshAfterLogoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: {
        origin: 'http://localhost:3000',
        cookie: rotatedRefreshCookie,
      },
    });

    assert.equal(refreshAfterLogoutRes.statusCode, 401, refreshAfterLogoutRes.body);
  });

  it('logout without an access token still revokes the refresh session', async () => {
    const email = uniqueEmail('logout-no-access');
    const password = 'super-secret-123';

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    const cookie = extractRefreshCookie(login.headers['set-cookie']);

    // No Authorization header: logout must not depend on a valid access token.
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { origin: 'http://localhost:3000', cookie },
    });
    assert.equal(logoutRes.statusCode, 201, logoutRes.body);

    const refreshAfterLogout = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { origin: 'http://localhost:3000', cookie },
    });
    assert.equal(refreshAfterLogout.statusCode, 401, refreshAfterLogout.body);
  });

  it('register returns 409 for duplicate email', async () => {
    const email = uniqueEmail('duplicate');
    const password = 'super-secret-123';

    const firstRegister = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password,
      },
    });

    assert.equal(firstRegister.statusCode, 201, firstRegister.body);

    const duplicateRegister = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password,
      },
    });

    assert.equal(duplicateRegister.statusCode, 409, duplicateRegister.body);
  });

  it('login returns 401 for invalid credentials', async () => {
    const email = uniqueEmail('bad-login');
    const password = 'super-secret-123';

    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password,
      },
    });

    assert.equal(registerRes.statusCode, 201, registerRes.body);

    const badLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email,
        password: 'wrong-password-123',
      },
    });

    assert.equal(badLoginRes.statusCode, 401, badLoginRes.body);
  });

  it('refresh returns 401 for invalid token', async () => {
    const badRefreshRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: {
        origin: 'http://localhost:3000',
        cookie: 'refresh_token=not-a-valid-refresh-token-value',
      },
    });

    assert.equal(badRefreshRes.statusCode, 401, badRefreshRes.body);
  });

  it('refresh returns 401 when refresh cookie is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: {
        origin: 'http://localhost:3000',
      },
    });

    assert.equal(res.statusCode, 401, res.body);
  });

  it('refresh returns 403 for disallowed origin', async () => {
    const email = uniqueEmail('origin-reject');
    const password = 'super-secret-123';

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });

    if (loginRes.statusCode !== 201) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email, password },
      });
    }

    const secondLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });

    const refreshCookie = extractRefreshCookie(secondLogin.headers['set-cookie']);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: {
        origin: 'https://attacker.example',
        cookie: refreshCookie,
      },
    });

    assert.equal(res.statusCode, 403, res.body);
  });

  it('GET /api/auth/me returns 401 when access token is invalid', async () => {
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    assert.equal(meRes.statusCode, 401, meRes.body);
  });

  it('GET /api/auth/me returns 401 when access token is missing', async () => {
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    assert.equal(meRes.statusCode, 401, meRes.body);
  });

  it('register returns 400 for a malformed email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'not-an-email',
        password: 'a-valid-password',
      },
    });

    assert.equal(res.statusCode, 400, res.body);
  });

  it('register returns 400 for a too-short password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: uniqueEmail('short-password'),
        password: 'short',
      },
    });

    assert.equal(res.statusCode, 400, res.body);
  });

  it('register returns 400 for unknown properties', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: uniqueEmail('unknown-field'),
        password: 'a-valid-password',
        role: 'ADMIN',
      },
    });

    assert.equal(res.statusCode, 400, res.body);
  });

  it('login returns 400 for a missing password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'someone@example.com',
      },
    });

    assert.equal(res.statusCode, 400, res.body);
  });
});
