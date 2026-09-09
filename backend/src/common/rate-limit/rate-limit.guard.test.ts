import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../../modules/auth/auth.types.js';
import { RateLimitGuard } from './rate-limit.guard.js';
import type { RateLimitConfig } from './rate-limit.decorator.js';
import { RateLimitStore } from './rate-limit.store.js';

type MockHttpArgumentsHost = {
  getRequest: <T = AuthenticatedRequest>() => T;
  getResponse: <T = FastifyReply>() => T;
};

type MockExecutionContext = {
  getHandler: () => () => void;
  getClass: () => typeof DummyController;
  switchToHttp: () => MockHttpArgumentsHost;
};

class DummyController {}

function createContext(
  request: AuthenticatedRequest,
  headers: Record<string, string>
): ExecutionContext {
  const response = {
    header: (name: string, value: string) => {
      headers[name] = value;
      return response;
    },
  } as unknown as FastifyReply;

  const context: MockExecutionContext = {
    getHandler: () => () => undefined,
    getClass: () => DummyController,
    switchToHttp: () => ({
      getRequest: <T = AuthenticatedRequest>() => request as T,
      getResponse: <T = FastifyReply>() => response as T,
    }),
  };

  return context as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  it('allows request and sets rate limit headers when under threshold', async () => {
    const reflectorMock = {
      getAllAndOverride: () => ({ maxRequests: 2, windowMs: 60_000 }) satisfies RateLimitConfig,
    };

    const storeMock = {
      hit: async () => ({
        allowed: true,
        limit: 2,
        remaining: 1,
        retryAfterSeconds: 60,
      }),
    };

    const guard = new RateLimitGuard(
      reflectorMock as unknown as Reflector,
      storeMock as unknown as RateLimitStore
    );

    const responseHeaders: Record<string, string> = {};
    const request = {
      method: 'GET',
      url: '/api/saved-filters/public',
      ip: '127.0.0.1',
      headers: {},
      raw: { socket: { remoteAddress: '127.0.0.1' } },
    } as unknown as AuthenticatedRequest;

    const allowed = await guard.canActivate(createContext(request, responseHeaders));

    assert.equal(allowed, true);
    assert.equal(responseHeaders['X-RateLimit-Limit'], '2');
    assert.equal(responseHeaders['X-RateLimit-Remaining'], '1');
    assert.equal(responseHeaders['Retry-After'], '60');
  });

  it('throws 429 when threshold is exceeded', async () => {
    const reflectorMock = {
      getAllAndOverride: () => ({ maxRequests: 1, windowMs: 60_000 }) satisfies RateLimitConfig,
    };

    const storeMock = {
      hit: async () => ({
        allowed: false,
        limit: 1,
        remaining: 0,
        retryAfterSeconds: 60,
      }),
    };

    const guard = new RateLimitGuard(
      reflectorMock as unknown as Reflector,
      storeMock as unknown as RateLimitStore
    );

    const responseHeaders: Record<string, string> = {};
    const request = {
      method: 'GET',
      url: '/api/saved-filters/public',
      headers: { 'x-forwarded-for': '203.0.113.42, 10.0.0.1' },
      raw: { socket: { remoteAddress: '127.0.0.1' } },
    } as unknown as AuthenticatedRequest;

    await assert.rejects(
      () => guard.canActivate(createContext(request, responseHeaders)),
      (error: unknown) => {
        assert.ok(error instanceof HttpException);
        assert.equal(error.getStatus(), HttpStatus.TOO_MANY_REQUESTS);
        assert.equal(responseHeaders['X-RateLimit-Limit'], '1');
        assert.equal(responseHeaders['X-RateLimit-Remaining'], '0');
        return true;
      }
    );
  });
});
