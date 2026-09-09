import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { CacheStore } from './cache.store.js';

const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const originalNodeEnv = process.env.NODE_ENV;
const originalCachePolicy = process.env.CACHE_OUTAGE_POLICY;

afterEach(() => {
  process.env.UPSTASH_REDIS_REST_URL = originalUrl;
  process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  process.env.NODE_ENV = originalNodeEnv;
  if (originalCachePolicy === undefined) {
    delete process.env.CACHE_OUTAGE_POLICY;
  } else {
    process.env.CACHE_OUTAGE_POLICY = originalCachePolicy;
  }
});

describe('CacheStore', () => {
  it('stores and retrieves values from in-memory fallback', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const store = new CacheStore();
    await store.set('a', 'value-a', 60);

    const value = await store.get('a');

    assert.equal(value, 'value-a');
  });

  it('expires in-memory values after ttl', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const store = new CacheStore();
    await store.set('b', 'value-b', 1);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const value = await store.get('b');
    assert.equal(value, undefined);
  });

  it('increments counters in memory fallback', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const store = new CacheStore();

    const first = await store.increment('counter-x');
    const second = await store.increment('counter-x');

    assert.equal(first, 1);
    assert.equal(second, 2);
  });

  it('exposes incremented counter through get() in memory fallback', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const store = new CacheStore();

    // Regression: increment() must write to the same store get() reads, so a
    // version bump is visible without Upstash (public-filter cache invalidation).
    assert.equal(await store.get('version-key'), undefined);

    await store.increment('version-key');
    assert.equal(await store.get('version-key'), '1');

    await store.increment('version-key');
    assert.equal(await store.get('version-key'), '2');
  });

  it('uses Upstash REST when configured', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; auth?: string }> = [];

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const authHeader =
        init?.headers && typeof init.headers === 'object' && 'Authorization' in init.headers
          ? String((init.headers as Record<string, string>).Authorization)
          : undefined;

      calls.push({ url, auth: authHeader });

      if (url.includes('/get/')) {
        return new Response(JSON.stringify({ result: 'from-upstash' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/incr/')) {
        return new Response(JSON.stringify({ result: 5 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ result: 'OK' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof globalThis.fetch;

    try {
      const store = new CacheStore();
      await store.set('key-1', 'value-1', 60);
      const value = await store.get('key-1');
      const counter = await store.increment('ctr-1');

      assert.equal(value, 'from-upstash');
      assert.equal(counter, 5);
      assert.equal(calls.length, 3);
      assert.equal(calls[0].auth, 'Bearer fake-token');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('falls back to memory when Upstash request errors', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () => {
      throw new Error('network unavailable');
    }) as typeof globalThis.fetch;

    try {
      const store = new CacheStore();
      await store.set('resilient-key', 'resilient-value', 60);
      const value = await store.get('resilient-key');

      assert.equal(value, 'resilient-value');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws when Upstash is not configured and policy is fail-closed', async () => {
    process.env.CACHE_OUTAGE_POLICY = 'fail-closed';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const store = new CacheStore();
    await assert.rejects(
      async () => {
        await store.get('missing-upstash');
      },
      {
        message: 'Upstash Redis store is required by the fail-closed cache policy',
      }
    );
  });

  it('falls back to memory when Upstash is optional (fail-open default)', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const store = new CacheStore();
    await store.set('opt', 'value-opt', 60);
    assert.equal(await store.get('opt'), 'value-opt');
  });

  it('falls back to memory when policy is fail-open and Upstash errors', async () => {
    process.env.NODE_ENV = 'development';
    process.env.CACHE_OUTAGE_POLICY = 'fail-open';
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('network unavailable');
    }) as typeof globalThis.fetch;

    try {
      const store = new CacheStore();
      await store.set('policy-fallback', 'ok', 60);
      const value = await store.get('policy-fallback');
      assert.equal(value, 'ok');
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.CACHE_OUTAGE_POLICY;
    }
  });

  it('logs missing optional Upstash configuration only once per store', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const warnings: string[] = [];
    const logger = {
      warn: (_context: string, message: string) => warnings.push(message),
    };
    const store = new CacheStore(logger as never);

    await store.set('once', 'value', 60);
    await store.get('once');
    await store.increment('counter');

    assert.deepEqual(warnings, ['Using in-memory fallback by policy']);
  });
});
