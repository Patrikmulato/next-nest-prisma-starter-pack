import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AccessTokenPayload, AuthenticatedRequest } from './auth.types.js';

type MockHttpArgumentsHost = {
  getRequest: <T = AuthenticatedRequest>() => T;
};

type MockExecutionContext = {
  switchToHttp: () => MockHttpArgumentsHost;
};

function createContext(request: AuthenticatedRequest): ExecutionContext {
  const context: MockExecutionContext = {
    switchToHttp: () => ({
      getRequest: <T = AuthenticatedRequest>() => request as T,
    }),
  };

  return context as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('accepts a valid bearer token and attaches user payload', async () => {
    const payload: AccessTokenPayload = {
      sub: 'user-1',
      email: 'user@example.com',
      role: 'USER',
    };

    const jwtServiceMock = {
      verifyAsync: async (token: string) => {
        assert.equal(token, 'good-token');
        return payload;
      },
    };

    const guard = new JwtAuthGuard(jwtServiceMock as unknown as JwtService);
    const request = {
      headers: { authorization: 'Bearer good-token' },
      raw: { headers: {} },
    } as unknown as AuthenticatedRequest;

    const allowed = await guard.canActivate(createContext(request));

    assert.equal(allowed, true);
    assert.deepEqual(request.user, payload);
  });

  it('accepts token from raw headers fallback', async () => {
    const payload: AccessTokenPayload = {
      sub: 'user-2',
      email: 'raw@example.com',
      role: 'CREATOR',
    };

    const jwtServiceMock = {
      verifyAsync: async () => payload,
    };

    const guard = new JwtAuthGuard(jwtServiceMock as unknown as JwtService);
    const request = {
      headers: {},
      raw: { headers: { authorization: 'Bearer raw-token' } },
    } as unknown as AuthenticatedRequest;

    const allowed = await guard.canActivate(createContext(request));

    assert.equal(allowed, true);
    assert.deepEqual(request.user, payload);
  });

  it('throws when authorization header is missing', async () => {
    const jwtServiceMock = {
      verifyAsync: async () => {
        throw new Error('should not be called');
      },
    };

    const guard = new JwtAuthGuard(jwtServiceMock as unknown as JwtService);
    const request = {
      headers: {},
      raw: { headers: {} },
    } as unknown as AuthenticatedRequest;

    await assert.rejects(
      () => guard.canActivate(createContext(request)),
      (error: unknown) => {
        assert.ok(error instanceof UnauthorizedException);
        assert.equal(error.message, 'Missing or invalid authorization header');
        return true;
      }
    );
  });

  it('throws when scheme is not bearer', async () => {
    const jwtServiceMock = {
      verifyAsync: async () => {
        throw new Error('should not be called');
      },
    };

    const guard = new JwtAuthGuard(jwtServiceMock as unknown as JwtService);
    const request = {
      headers: { authorization: 'Basic abc' },
      raw: { headers: {} },
    } as unknown as AuthenticatedRequest;

    await assert.rejects(
      () => guard.canActivate(createContext(request)),
      (error: unknown) => {
        assert.ok(error instanceof UnauthorizedException);
        assert.equal(error.message, 'Missing or invalid authorization header');
        return true;
      }
    );
  });

  it('throws when token verification fails', async () => {
    const jwtServiceMock = {
      verifyAsync: async () => {
        throw new Error('bad token');
      },
    };

    const guard = new JwtAuthGuard(jwtServiceMock as unknown as JwtService);
    const request = {
      headers: { authorization: 'Bearer bad-token' },
      raw: { headers: {} },
    } as unknown as AuthenticatedRequest;

    await assert.rejects(
      () => guard.canActivate(createContext(request)),
      (error: unknown) => {
        assert.ok(error instanceof UnauthorizedException);
        assert.equal(error.message, 'Invalid or expired token');
        return true;
      }
    );
  });
});
