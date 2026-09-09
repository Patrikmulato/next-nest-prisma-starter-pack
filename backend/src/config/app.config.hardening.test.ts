import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { getAppConfig } from './app.config.js';

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  CACHE_OUTAGE_POLICY: process.env.CACHE_OUTAGE_POLICY,
  RATE_LIMIT_OUTAGE_POLICY: process.env.RATE_LIMIT_OUTAGE_POLICY,
};

function restoreEnvVar(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

afterEach(() => {
  restoreEnvVar('NODE_ENV', ORIGINAL_ENV.NODE_ENV);
  restoreEnvVar('DATABASE_URL', ORIGINAL_ENV.DATABASE_URL);
  restoreEnvVar('JWT_SECRET', ORIGINAL_ENV.JWT_SECRET);
  restoreEnvVar('JWT_REFRESH_SECRET', ORIGINAL_ENV.JWT_REFRESH_SECRET);
  restoreEnvVar('UPSTASH_REDIS_REST_URL', ORIGINAL_ENV.UPSTASH_REDIS_REST_URL);
  restoreEnvVar('UPSTASH_REDIS_REST_TOKEN', ORIGINAL_ENV.UPSTASH_REDIS_REST_TOKEN);
  restoreEnvVar('CACHE_OUTAGE_POLICY', ORIGINAL_ENV.CACHE_OUTAGE_POLICY);
  restoreEnvVar('RATE_LIMIT_OUTAGE_POLICY', ORIGINAL_ENV.RATE_LIMIT_OUTAGE_POLICY);
});

describe('AppConfig hardening policy', () => {
  it('allows missing Upstash env vars in production (optional shared store)', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://example';
    process.env.JWT_SECRET = 'jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'jwt-refresh-secret';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const config = getAppConfig();

    assert.equal(config.nodeEnv, 'production');
    assert.equal(config.cacheOutagePolicy, 'fail-open');
    assert.equal(config.rateLimitOutagePolicy, 'fail-open');
  });

  it('parses outage policies from env', () => {
    process.env.NODE_ENV = 'development';
    process.env.CACHE_OUTAGE_POLICY = 'fail-open';
    process.env.RATE_LIMIT_OUTAGE_POLICY = 'fail-closed';

    const config = getAppConfig();

    assert.equal(config.cacheOutagePolicy, 'fail-open');
    assert.equal(config.rateLimitOutagePolicy, 'fail-closed');
  });
});
