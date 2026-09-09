import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isOriginAllowed } from './app-setup.js';

const allowedOrigins = ['http://localhost:3000', 'https://coach-patrik.vercel.app'];

describe('isOriginAllowed', () => {
  it('allows requests with no origin (curl, same-origin, mobile)', () => {
    assert.equal(isOriginAllowed(undefined, allowedOrigins), true);
  });

  it('allows explicitly allow-listed origins', () => {
    assert.equal(isOriginAllowed('http://localhost:3000', allowedOrigins), true);
    assert.equal(isOriginAllowed('https://coach-patrik.vercel.app', allowedOrigins), true);
  });

  it("allows this project's Vercel preview deployments", () => {
    assert.equal(
      isOriginAllowed('https://coach-patrik-git-main-team.vercel.app', allowedOrigins),
      true
    );
    assert.equal(
      isOriginAllowed('https://coach-patrik-abc123-team.vercel.app', allowedOrigins),
      true
    );
  });

  it('rejects arbitrary *.vercel.app origins', () => {
    assert.equal(isOriginAllowed('https://evil-xyz.vercel.app', allowedOrigins), false);
    assert.equal(isOriginAllowed('https://coach-patrik.evil.vercel.app', allowedOrigins), false);
  });

  it('rejects unrelated origins', () => {
    assert.equal(isOriginAllowed('https://evil.com', allowedOrigins), false);
  });
});
