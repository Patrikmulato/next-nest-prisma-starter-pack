import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import type { AccessTokenPayload, AuthenticatedRequest } from './auth.types.js';

type MockHttpArgumentsHost = {
  getRequest: <T = AuthenticatedRequest>() => T;
};

type MockExecutionContext = {
  getHandler: () => () => void;
  getClass: () => typeof DummyController;
  switchToHttp: () => MockHttpArgumentsHost;
};

class DummyController {}

function createContext(request: AuthenticatedRequest): ExecutionContext {
  const context: MockExecutionContext = {
    getHandler: () => () => undefined,
    getClass: () => DummyController,
    switchToHttp: () => ({
      getRequest: <T = AuthenticatedRequest>() => request as T,
    }),
  };

  return context as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const reflectorMock = {
      getAllAndOverride: () => undefined,
    };

    const guard = new RolesGuard(reflectorMock as unknown as Reflector);
    const request = {
      user: { role: 'USER' as AccessTokenPayload['role'] },
    } as AuthenticatedRequest;

    const allowed = guard.canActivate(createContext(request));

    assert.equal(allowed, true);
  });

  it('allows access when user role is included in required roles', () => {
    const reflectorMock = {
      getAllAndOverride: () => ['CREATOR', 'ADMIN'] as Array<AccessTokenPayload['role']>,
    };

    const guard = new RolesGuard(reflectorMock as unknown as Reflector);
    const request = {
      user: { role: 'ADMIN' as AccessTokenPayload['role'] },
    } as AuthenticatedRequest;

    const allowed = guard.canActivate(createContext(request));

    assert.equal(allowed, true);
  });

  it('throws forbidden when role does not match', () => {
    const reflectorMock = {
      getAllAndOverride: () => ['ADMIN'] as Array<AccessTokenPayload['role']>,
    };

    const guard = new RolesGuard(reflectorMock as unknown as Reflector);
    const request = {
      user: { role: 'USER' as AccessTokenPayload['role'] },
    } as AuthenticatedRequest;

    assert.throws(
      () => guard.canActivate(createContext(request)),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(error.message, 'You do not have permission to access this resource');
        return true;
      }
    );
  });

  it('throws forbidden when user is missing from request', () => {
    const reflectorMock = {
      getAllAndOverride: () => ['ADMIN'] as Array<AccessTokenPayload['role']>,
    };

    const guard = new RolesGuard(reflectorMock as unknown as Reflector);
    const request = {} as AuthenticatedRequest;

    assert.throws(
      () => guard.canActivate(createContext(request)),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(error.message, 'You do not have permission to access this resource');
        return true;
      }
    );
  });
});
