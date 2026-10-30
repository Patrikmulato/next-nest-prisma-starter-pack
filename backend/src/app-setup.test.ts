import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isOriginAllowed } from './app-setup.js';

const allowedOrigins = ['http://localhost:3000', 'https://app.example.com'];

describe('isOriginAllowed', () => {
  it('allows requests with no origin (curl, same-origin, mobile)', () => {
    assert.equal(isOriginAllowed(undefined, allowedOrigins), true);
  });

  it('allows explicitly allow-listed origins', () => {
    assert.equal(isOriginAllowed('http://localhost:3000', allowedOrigins), true);
    assert.equal(isOriginAllowed('https://app.example.com', allowedOrigins), true);
  });

  it('rejects unconfigured Vercel deployments', () => {
    assert.equal(isOriginAllowed('https://preview-123.vercel.app', allowedOrigins), false);
  });

  it('rejects arbitrary Vercel origins', () => {
    assert.equal(isOriginAllowed('https://evil-xyz.vercel.app', allowedOrigins), false);
    assert.equal(isOriginAllowed('https://app.example.com.evil.vercel.app', allowedOrigins), false);
  });

  it('rejects unrelated origins', () => {
    assert.equal(isOriginAllowed('https://evil.com', allowedOrigins), false);
  });
});
