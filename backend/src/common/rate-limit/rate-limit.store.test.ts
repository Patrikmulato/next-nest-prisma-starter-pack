import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { RateLimitStore } from './rate-limit.store.js';

const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const originalNodeEnv = process.env.NODE_ENV;
const originalRatePolicy = process.env.RATE_LIMIT_OUTAGE_POLICY;

afterEach(() => {
  process.env.UPSTASH_REDIS_REST_URL = originalUrl;
  process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  process.env.NODE_ENV = originalNodeEnv;
  if (originalRatePolicy === undefined) {
    delete process.env.RATE_LIMIT_OUTAGE_POLICY;
  } else {
    process.env.RATE_LIMIT_OUTAGE_POLICY = originalRatePolicy;
  }
});

describe('RateLimitStore', () => {
  it('applies in-memory window limits when upstash env vars are not set', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const store = new RateLimitStore();

    const first = await store.hit('k1', 2, 60_000);
    const second = await store.hit('k1', 2, 60_000);
    const third = await store.hit('k1', 2, 60_000);

    assert.equal(first.allowed, true);
    assert.equal(first.remaining, 1);

    assert.equal(second.allowed, true);
    assert.equal(second.remaining, 0);

    assert.equal(third.allowed, false);
    assert.equal(third.remaining, 0);
    assert.equal(third.limit, 2);
  });

  it('uses upstash backend when both url and token are set', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    const calls: Array<string> = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      calls.push(url);

      if (url.includes('/incr/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: 1 }),
        } as Response;
      }

      if (url.includes('/expire/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: 1 }),
        } as Response;
      }

      return {
        ok: false,
        status: 500,
        json: async () => ({ result: 0 }),
      } as Response;
    }) as typeof fetch;

    try {
      const store = new RateLimitStore();
      const result = await store.hit('k2', 3, 30_000);

      assert.equal(result.allowed, true);
      assert.equal(result.remaining, 2);
      assert.equal(calls.length, 2);
      assert.ok(calls[0].includes('/incr/'));
      assert.ok(calls[1].includes('/expire/'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws when Upstash is missing and policy is fail-closed', async () => {
    process.env.RATE_LIMIT_OUTAGE_POLICY = 'fail-closed';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const store = new RateLimitStore();
    await assert.rejects(
      async () => {
        await store.hit('k3', 2, 60_000);
      },
      {
        message: 'Upstash Redis store is required by the fail-closed rate-limit policy',
      }
    );
  });

  it('applies in-memory limits when Upstash is optional (fail-open default)', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const store = new RateLimitStore();
    const first = await store.hit('prod-key', 1, 60_000);
    const second = await store.hit('prod-key', 1, 60_000);

    assert.equal(first.allowed, true);
    assert.equal(second.allowed, false);
  });

  it('falls back to memory when policy is fail-open and Upstash errors', async () => {
    process.env.NODE_ENV = 'development';
    process.env.RATE_LIMIT_OUTAGE_POLICY = 'fail-open';
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('upstash unavailable');
    }) as typeof fetch;

    try {
      const store = new RateLimitStore();
      const first = await store.hit('fallback-key', 1, 60_000);
      const second = await store.hit('fallback-key', 1, 60_000);

      assert.equal(first.allowed, true);
      assert.equal(second.allowed, false);
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.RATE_LIMIT_OUTAGE_POLICY;
    }
  });

  it('logs missing optional Upstash configuration only once per store', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const warnings: string[] = [];
    const logger = {
      warn: (_context: string, message: string) => warnings.push(message),
    };
    const store = new RateLimitStore(logger as never);

    await store.hit('one', 10, 60_000);
    await store.hit('two', 10, 60_000);

    assert.deepEqual(warnings, ['Using in-memory fallback by policy']);
  });

  it('passes a timeout signal to Upstash requests', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    const originalFetch = globalThis.fetch;
    let capturedSignal: AbortSignal | null | undefined;

    globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      capturedSignal = init?.signal;
      return new Response(JSON.stringify({ result: 2 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    try {
      const store = new RateLimitStore();
      await store.hit('timeout-signal', 3, 60_000);
      assert.ok(capturedSignal instanceof AbortSignal);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
