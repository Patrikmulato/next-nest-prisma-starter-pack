import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APP_GUARD } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard.js';

type ModuleProvider =
  { provide?: unknown; useClass?: unknown } | (new (...args: never[]) => unknown);

describe('AppModule hardening wiring', () => {
  it('registers RateLimitGuard as a global APP_GUARD', () => {
    const providers = (Reflect.getMetadata('providers', AppModule) ?? []) as ModuleProvider[];

    const appGuardProvider = providers.find(
      (provider): provider is { provide: unknown; useClass: unknown } =>
        typeof provider === 'object' &&
        provider !== null &&
        'provide' in provider &&
        'useClass' in provider &&
        provider.provide === APP_GUARD
    );

    assert.ok(appGuardProvider);
    assert.equal(appGuardProvider.useClass, RateLimitGuard);
  });
});
