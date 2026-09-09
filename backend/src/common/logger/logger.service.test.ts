import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { LoggerService } from './logger.service.js';

type ConsoleMethod = (message?: unknown, ...optionalParams: Array<unknown>) => void;

const originalEnv = process.env.NODE_ENV;
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

afterEach(() => {
  process.env.NODE_ENV = originalEnv;
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
});

describe('LoggerService', () => {
  it('suppresses non-error logs in test environment', () => {
    process.env.NODE_ENV = 'test';

    const logger = new LoggerService();
    let logCalled = false;

    console.log = (() => {
      logCalled = true;
    }) as ConsoleMethod;

    logger.log('TestContext', 'should be suppressed');

    assert.equal(logCalled, false);
  });

  it('writes error logs even in test environment', () => {
    process.env.NODE_ENV = 'test';

    const logger = new LoggerService();
    let captured: string | undefined;

    console.error = ((message?: unknown) => {
      if (typeof message === 'string') {
        captured = message;
      }
    }) as ConsoleMethod;

    logger.error('AuthService', 'token failure', { userId: 'u-1' });

    assert.ok(captured);
    const parsed = JSON.parse(captured) as Record<string, unknown>;
    assert.equal(parsed.level, 'error');
    assert.equal(parsed.context, 'AuthService');
    assert.equal(parsed.message, 'token failure');
    assert.equal(parsed.userId, 'u-1');
  });

  it('writes warn logs in non-test environment', () => {
    process.env.NODE_ENV = 'development';

    const logger = new LoggerService();
    let captured: string | undefined;

    console.warn = ((message?: unknown) => {
      if (typeof message === 'string') {
        captured = message;
      }
    }) as ConsoleMethod;

    logger.warn('UsersService', 'low disk');

    assert.ok(captured);
    const parsed = JSON.parse(captured) as Record<string, unknown>;
    assert.equal(parsed.level, 'warn');
    assert.equal(parsed.context, 'UsersService');
    assert.equal(parsed.message, 'low disk');
  });

  it('writes info logs in non-test environment', () => {
    process.env.NODE_ENV = 'development';

    const logger = new LoggerService();
    let captured: string | undefined;

    console.log = ((message?: unknown) => {
      if (typeof message === 'string') {
        captured = message;
      }
    }) as ConsoleMethod;

    logger.log('SavedFiltersService', 'created');

    assert.ok(captured);
    const parsed = JSON.parse(captured) as Record<string, unknown>;
    assert.equal(parsed.level, 'info');
    assert.equal(parsed.context, 'SavedFiltersService');
    assert.equal(parsed.message, 'created');
  });
});
