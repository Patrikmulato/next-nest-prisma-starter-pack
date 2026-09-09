import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../../../generated/prisma/index.js';
import { hashPassword } from '../../common/utils/password-hash.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

type JwtServiceLike = {
  signAsync: (
    payload: { sub: string; email: string; role: UserRole },
    options?: { expiresIn?: string; secret?: string }
  ) => Promise<string>;
  verifyAsync: <T>(token: string, options?: { secret?: string }) => Promise<T>;
};

describe('AuthService', () => {
  it('register creates a user and returns issued session', async () => {
    let capturedPasswordHash: string | undefined;
    let capturedRefreshTokenHash: string | undefined;

    const prismaMock = {
      user: {
        findUnique: async () => null,
        create: async (input: {
          data: { email: string; passwordHash: string; role: UserRole };
          select: { id: true; email: true; role: true };
        }) => {
          capturedPasswordHash = input.data.passwordHash;
          return {
            id: 'user-1',
            email: input.data.email,
            role: UserRole.USER,
          };
        },
        update: async (input: {
          where: { id: string };
          data: { refreshTokenHash: string | null };
        }) => {
          capturedRefreshTokenHash = input.data.refreshTokenHash ?? undefined;
          return {
            id: input.where.id,
          };
        },
      },
    };

    const jwtMock: JwtServiceLike = {
      signAsync: async (payload, options) => {
        if (options?.expiresIn === '7d') {
          return `refresh-${payload.sub}`;
        }
        return `access-${payload.sub}`;
      },
      verifyAsync: async () => {
        throw new Error('verify should not be called');
      },
    };

    const service = new AuthService(
      prismaMock as unknown as PrismaService,
      jwtMock as AuthService['jwtService']
    );

    const result = await service.register({
      email: 'auth@example.com',
      password: 'super-secret',
    });

    assert.equal(result.response.accessToken, 'access-user-1');
    assert.equal(result.refreshToken, 'refresh-user-1');
    assert.equal(result.response.user.id, 'user-1');
    assert.equal(result.response.user.email, 'auth@example.com');
    assert.equal(result.response.user.role, UserRole.USER);
    assert.equal('passwordHash' in result.response.user, false);
    assert.equal('refreshTokenHash' in result.response.user, false);
    assert.ok(capturedPasswordHash);
    assert.match(capturedPasswordHash, /^scrypt\$/);
    assert.ok(capturedRefreshTokenHash);
    assert.match(capturedRefreshTokenHash, /^scrypt\$/);
  });

  it('register grants admin only to an allowlisted email', async () => {
    const originalAdminEmails = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = 'admin@example.com, second-admin@example.com ';

    try {
      let capturedRole: UserRole | undefined;
      const prismaMock = {
        user: {
          findUnique: async () => null,
          create: async (input: {
            data: { email: string; passwordHash: string; role: UserRole };
            select: { id: true; email: true; role: true };
          }) => {
            capturedRole = input.data.role;
            return { id: 'admin-1', email: input.data.email, role: input.data.role };
          },
          update: async () => ({ id: 'admin-1' }),
        },
      };
      const jwtMock: JwtServiceLike = {
        signAsync: async (payload, options) =>
          options?.expiresIn === '7d' ? `refresh-${payload.sub}` : `access-${payload.sub}`,
        verifyAsync: async () => {
          throw new Error('verify should not be called');
        },
      };
      const service = new AuthService(
        prismaMock as unknown as PrismaService,
        jwtMock as AuthService['jwtService']
      );

      const result = await service.register({
        email: 'ADMIN@EXAMPLE.COM',
        password: 'super-secret',
      });

      assert.equal(capturedRole, UserRole.ADMIN);
      assert.equal(result.response.user.role, UserRole.ADMIN);
    } finally {
      if (originalAdminEmails === undefined) {
        delete process.env.ADMIN_EMAILS;
      } else {
        process.env.ADMIN_EMAILS = originalAdminEmails;
      }
    }
  });

  it('promotes an existing allowlisted user on login', async () => {
    const originalAdminEmails = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = 'admin@example.com';

    try {
      const storedHash = await hashPassword('super-secret');
      let promotedRole: UserRole | undefined;
      const prismaMock = {
        user: {
          findUnique: async () => ({
            id: 'existing-user',
            email: 'admin@example.com',
            role: UserRole.USER,
            passwordHash: storedHash,
          }),
          create: async () => {
            throw new Error('create should not be called');
          },
          update: async (input: {
            where: { id: string };
            data: { role?: UserRole; refreshTokenHash?: string | null };
          }) => {
            promotedRole ??= input.data.role;
            return { id: input.where.id };
          },
        },
      };
      const jwtMock: JwtServiceLike = {
        signAsync: async (payload, options) =>
          options?.expiresIn === '7d' ? `refresh-${payload.sub}` : `access-${payload.sub}`,
        verifyAsync: async () => {
          throw new Error('verify should not be called');
        },
      };
      const service = new AuthService(
        prismaMock as unknown as PrismaService,
        jwtMock as AuthService['jwtService']
      );

      const result = await service.login({ email: 'admin@example.com', password: 'super-secret' });

      assert.equal(promotedRole, UserRole.ADMIN);
      assert.equal(result.response.user.role, UserRole.ADMIN);
    } finally {
      if (originalAdminEmails === undefined) {
        delete process.env.ADMIN_EMAILS;
      } else {
        process.env.ADMIN_EMAILS = originalAdminEmails;
      }
    }
  });

  it('register throws ConflictException for duplicate email', async () => {
    const prismaMock = {
      user: {
        findUnique: async () => ({ id: 'existing-user' }),
        create: async () => {
          throw new Error('create should not be called');
        },
        update: async () => {
          throw new Error('update should not be called');
        },
      },
    };

    const jwtMock: JwtServiceLike = {
      signAsync: async () => 'unused',
      verifyAsync: async () => {
        throw new Error('verify should not be called');
      },
    };

    const service = new AuthService(
      prismaMock as unknown as PrismaService,
      jwtMock as AuthService['jwtService']
    );

    await assert.rejects(
      service.register({ email: 'existing@example.com', password: 'super-secret' }),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message === 'A user with this email already exists'
    );
  });

  it('login returns issued session for valid credentials', async () => {
    const storedHash = await hashPassword('super-secret');
    let capturedRefreshTokenHash: string | undefined;

    const prismaMock = {
      user: {
        findUnique: async () => ({
          id: 'user-2',
          email: 'login@example.com',
          role: UserRole.CREATOR,
          passwordHash: storedHash,
        }),
        create: async () => {
          throw new Error('create should not be called');
        },
        update: async (input: {
          where: { id: string };
          data: { refreshTokenHash: string | null };
        }) => {
          capturedRefreshTokenHash = input.data.refreshTokenHash ?? undefined;
          return {
            id: input.where.id,
          };
        },
      },
    };

    const jwtMock: JwtServiceLike = {
      signAsync: async (payload, options) => {
        if (options?.expiresIn === '7d') {
          return `refresh-${payload.sub}`;
        }
        return `access-${payload.sub}`;
      },
      verifyAsync: async () => {
        throw new Error('verify should not be called');
      },
    };

    const service = new AuthService(
      prismaMock as unknown as PrismaService,
      jwtMock as AuthService['jwtService']
    );

    const result = await service.login({ email: 'login@example.com', password: 'super-secret' });

    assert.equal(result.response.accessToken, 'access-user-2');
    assert.equal(result.refreshToken, 'refresh-user-2');
    assert.equal(result.response.user.role, UserRole.CREATOR);
    assert.equal('passwordHash' in result.response.user, false);
    assert.equal('refreshTokenHash' in result.response.user, false);
    assert.ok(capturedRefreshTokenHash);
    assert.match(capturedRefreshTokenHash, /^scrypt\$/);
  });

  it('login throws UnauthorizedException for invalid credentials', async () => {
    const storedHash = await hashPassword('correct-password');

    const prismaMock = {
      user: {
        findUnique: async () => ({
          id: 'user-3',
          email: 'invalid@example.com',
          role: UserRole.USER,
          passwordHash: storedHash,
        }),
        create: async () => {
          throw new Error('create should not be called');
        },
        update: async () => {
          throw new Error('update should not be called');
        },
      },
    };

    const jwtMock: JwtServiceLike = {
      signAsync: async () => 'unused',
      verifyAsync: async () => {
        throw new Error('verify should not be called');
      },
    };

    const service = new AuthService(
      prismaMock as unknown as PrismaService,
      jwtMock as AuthService['jwtService']
    );

    await assert.rejects(
      service.login({ email: 'invalid@example.com', password: 'wrong-password' }),
      (error: unknown) =>
        error instanceof UnauthorizedException && error.message === 'Invalid credentials'
    );
  });

  it('refresh rotates tokens when refresh token is valid', async () => {
    const storedRefreshHash = await hashPassword('refresh-user-4');
    let capturedRefreshTokenHash: string | undefined;

    const prismaMock = {
      user: {
        findUnique: async (input: { where: { id?: string; email?: string } }) => {
          if (input.where.id) {
            return {
              id: 'user-4',
              email: 'refresh@example.com',
              role: UserRole.USER,
              refreshTokenHash: storedRefreshHash,
            };
          }

          return null;
        },
        create: async () => {
          throw new Error('create should not be called');
        },
        update: async (input: {
          where: { id: string };
          data: { refreshTokenHash: string | null };
        }) => {
          capturedRefreshTokenHash = input.data.refreshTokenHash ?? undefined;
          return {
            id: input.where.id,
          };
        },
      },
    };

    const jwtMock: JwtServiceLike = {
      signAsync: async (payload, options) => {
        if (options?.expiresIn === '7d') {
          return `refresh-${payload.sub}-new`;
        }

        return `access-${payload.sub}-new`;
      },
      verifyAsync: async <T>() =>
        ({
          sub: 'user-4',
          email: 'refresh@example.com',
          role: UserRole.USER,
        }) as T,
    };

    const service = new AuthService(
      prismaMock as unknown as PrismaService,
      jwtMock as AuthService['jwtService']
    );

    const result = await service.refresh('refresh-user-4');

    assert.equal(result.response.accessToken, 'access-user-4-new');
    assert.equal(result.refreshToken, 'refresh-user-4-new');
    assert.equal('passwordHash' in result.response.user, false);
    assert.equal('refreshTokenHash' in result.response.user, false);
    assert.ok(capturedRefreshTokenHash);
    assert.match(capturedRefreshTokenHash, /^scrypt\$/);
  });

  it('logoutByRefreshToken clears the hash when the token matches the current session', async () => {
    const refreshToken = 'current-refresh-token';
    const storedRefreshHash = await hashPassword(refreshToken);
    let capturedRefreshTokenHash: string | null | undefined;

    const prismaMock = {
      user: {
        findUnique: async () => ({ refreshTokenHash: storedRefreshHash }),
        create: async () => {
          throw new Error('create should not be called');
        },
        update: async (input: {
          where: { id: string };
          data: { refreshTokenHash: string | null };
        }) => {
          capturedRefreshTokenHash = input.data.refreshTokenHash;
          return {
            id: input.where.id,
          };
        },
      },
    };

    const jwtMock: JwtServiceLike = {
      signAsync: async () => 'unused',
      verifyAsync: async <T>() => ({ sub: 'user-9' }) as T,
    };

    const service = new AuthService(
      prismaMock as unknown as PrismaService,
      jwtMock as AuthService['jwtService']
    );

    await service.logoutByRefreshToken(refreshToken);

    assert.equal(capturedRefreshTokenHash, null);
  });

  it('logoutByRefreshToken does not revoke the current session for a rotated token', async () => {
    const storedRefreshHash = await hashPassword('current-refresh-token');
    let updateCalled = false;

    const prismaMock = {
      user: {
        findUnique: async () => ({ refreshTokenHash: storedRefreshHash }),
        update: async () => {
          updateCalled = true;
        },
      },
    };
    const jwtMock: JwtServiceLike = {
      signAsync: async () => 'unused',
      verifyAsync: async <T>() => ({ sub: 'user-9' }) as T,
    };
    const service = new AuthService(
      prismaMock as unknown as PrismaService,
      jwtMock as AuthService['jwtService']
    );

    await service.logoutByRefreshToken('rotated-refresh-token');

    assert.equal(updateCalled, false);
  });

  it('logoutByRefreshToken propagates database revocation failures', async () => {
    const refreshToken = 'current-refresh-token';
    const storedRefreshHash = await hashPassword(refreshToken);

    const prismaMock = {
      user: {
        findUnique: async () => ({ refreshTokenHash: storedRefreshHash }),
        update: async () => {
          throw new Error('database unavailable');
        },
      },
    };
    const jwtMock: JwtServiceLike = {
      signAsync: async () => 'unused',
      verifyAsync: async <T>() => ({ sub: 'user-9' }) as T,
    };
    const service = new AuthService(
      prismaMock as unknown as PrismaService,
      jwtMock as AuthService['jwtService']
    );

    await assert.rejects(() => service.logoutByRefreshToken(refreshToken), /database unavailable/);
  });
});
