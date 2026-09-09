import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  getRefreshTokenCookieOptions,
  resolveAccessTokenSecret,
  resolveRefreshTokenSecret,
} from './auth.constants.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalJwtSecret = process.env.JWT_SECRET;
const originalJwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
const originalFrontendUrl = process.env.FRONTEND_URL;
const originalVercelUrl = process.env.VERCEL_URL;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.JWT_SECRET = originalJwtSecret;
  process.env.JWT_REFRESH_SECRET = originalJwtRefreshSecret;
  process.env.FRONTEND_URL = originalFrontendUrl;
  process.env.VERCEL_URL = originalVercelUrl;
});

describe('auth constants', () => {
  it('uses explicit JWT secrets when provided', () => {
    process.env.JWT_SECRET = 'access-explicit';
    process.env.JWT_REFRESH_SECRET = 'refresh-explicit';

    assert.equal(resolveAccessTokenSecret(), 'access-explicit');
    assert.equal(resolveRefreshTokenSecret(), 'refresh-explicit');
  });

  it('uses test defaults in test environment without explicit secrets', () => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    process.env.NODE_ENV = 'test';

    assert.equal(resolveAccessTokenSecret(), 'test-jwt-secret');
    assert.equal(resolveRefreshTokenSecret(), 'test-jwt-refresh-secret');
  });

  it('uses development fallbacks outside test when explicit secrets are missing', () => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    process.env.NODE_ENV = 'development';

    assert.equal(resolveAccessTokenSecret(), 'dev-jwt-secret-change-me');
    assert.equal(resolveRefreshTokenSecret(), 'dev-jwt-refresh-secret-change-me');
  });

  it('uses SameSite=Lax outside production regardless of cross-site config', () => {
    process.env.NODE_ENV = 'development';
    process.env.FRONTEND_URL = 'https://geo-helpers.vercel.app';
    process.env.VERCEL_URL = 'geo-helpers-backend.vercel.app';

    assert.equal(getRefreshTokenCookieOptions().sameSite, 'lax');
    assert.equal(getRefreshTokenCookieOptions().secure, false);
  });

  it('uses SameSite=Lax in production when frontend and backend share a host', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://geo-helpers-backend.vercel.app';
    process.env.VERCEL_URL = 'geo-helpers-backend.vercel.app';

    assert.equal(getRefreshTokenCookieOptions().sameSite, 'lax');
  });

  it('uses SameSite=Lax in production when VERCEL_URL is unset (non-Vercel host)', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://geo-helpers.vercel.app';
    delete process.env.VERCEL_URL;

    assert.equal(getRefreshTokenCookieOptions().sameSite, 'lax');
  });

  it('uses SameSite=None + Secure in production when frontend and backend are cross-site', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://geo-helpers.vercel.app';
    process.env.VERCEL_URL = 'geo-helpers-backend.vercel.app';

    const options = getRefreshTokenCookieOptions();
    assert.equal(options.sameSite, 'none');
    assert.equal(options.secure, true);
  });
});
