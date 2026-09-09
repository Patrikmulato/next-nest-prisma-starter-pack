import { Injectable } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service.js';
import { getAppConfig } from '../../config/app.config.js';

type MemoryCacheEntry = {
  value: string;
  expiresAtMs: number;
};

const MEMORY_CACHE_SOFT_LIMIT = 3000;
const UPSTASH_REQUEST_TIMEOUT_MS = 2000;

@Injectable()
export class CacheStore {
  private readonly memory = new Map<string, MemoryCacheEntry>();
  private readonly logger: LoggerService;
  private hasLoggedMissingStore = false;
  private hasLoggedStoreFailure = false;

  constructor(logger: LoggerService = new LoggerService()) {
    this.logger = logger;
  }

  async get(key: string): Promise<string | undefined> {
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!upstashUrl || !upstashToken) {
      if (this.shouldFailClosed()) {
        throw new Error('Upstash Redis store is required by the fail-closed cache policy');
      }

      this.warnMissingStoreOnce();
    }

    if (upstashUrl && upstashToken) {
      try {
        const result = await this.upstashCommand<string | null>(
          `${upstashUrl}/get/${encodeURIComponent(key)}`,
          upstashToken
        );

        return result ?? undefined;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown Upstash error';
        this.warnStoreFailureOnce('get', key, message);
        if (this.shouldFailClosed()) {
          throw new Error('Upstash Redis store is required by the fail-closed cache policy');
        }
        // Fall back to memory when Upstash is unavailable.
      }
    }

    const entry = this.memory.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAtMs <= Date.now()) {
      this.memory.delete(key);
      return undefined;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!upstashUrl || !upstashToken) {
      if (this.shouldFailClosed()) {
        throw new Error('Upstash Redis store is required by the fail-closed cache policy');
      }

      this.warnMissingStoreOnce();
    }

    if (upstashUrl && upstashToken) {
      try {
        await this.upstashCommand<string>(
          `${upstashUrl}/setex/${encodeURIComponent(key)}/${Math.max(1, ttlSeconds)}/${encodeURIComponent(value)}`,
          upstashToken
        );

        return;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown Upstash error';
        this.warnStoreFailureOnce('set', key, message, { ttlSeconds });
        if (this.shouldFailClosed()) {
          throw new Error('Upstash Redis store is required by the fail-closed cache policy');
        }
        // Fall back to memory when Upstash is unavailable.
      }
    }

    const expiresAtMs = Date.now() + Math.max(1, ttlSeconds) * 1000;
    this.memory.set(key, { value, expiresAtMs });
    this.gcMemory();
  }

  async increment(key: string): Promise<number> {
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!upstashUrl || !upstashToken) {
      if (this.shouldFailClosed()) {
        throw new Error('Upstash Redis store is required by the fail-closed cache policy');
      }

      this.warnMissingStoreOnce();
    }

    if (upstashUrl && upstashToken) {
      try {
        return await this.upstashCommand<number>(
          `${upstashUrl}/incr/${encodeURIComponent(key)}`,
          upstashToken
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown Upstash error';
        this.warnStoreFailureOnce('increment', key, message);
        if (this.shouldFailClosed()) {
          throw new Error('Upstash Redis store is required by the fail-closed cache policy');
        }
        // Fall back to memory when Upstash is unavailable.
      }
    }

    // Keep the counter in the same `memory` map that get() reads, so version
    // bumps are actually visible in the in-memory (no-Upstash) path. Counters
    // must not expire, hence the far-future expiry.
    const entry = this.memory.get(key);
    const current = entry ? Number(entry.value) : 0;
    const next = (Number.isFinite(current) ? current : 0) + 1;
    this.memory.set(key, { value: String(next), expiresAtMs: Number.MAX_SAFE_INTEGER });
    return next;
  }

  private async upstashCommand<T>(url: string, token: string): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(UPSTASH_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Upstash cache request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { result?: T };
    if (!('result' in payload)) {
      throw new Error('Upstash cache response missing result field');
    }

    return payload.result as T;
  }

  private gcMemory(): void {
    if (this.memory.size <= MEMORY_CACHE_SOFT_LIMIT) {
      return;
    }

    const nowMs = Date.now();
    for (const [key, entry] of this.memory.entries()) {
      if (entry.expiresAtMs <= nowMs) {
        this.memory.delete(key);
      }
    }
  }

  private shouldFailClosed(): boolean {
    return getAppConfig().cacheOutagePolicy === 'fail-closed';
  }

  private warnMissingStoreOnce(): void {
    if (this.hasLoggedMissingStore) {
      return;
    }

    this.hasLoggedMissingStore = true;
    this.logger.warn('CacheStore', 'Using in-memory fallback by policy', {
      policy: getAppConfig().cacheOutagePolicy,
    });
  }

  private warnStoreFailureOnce(
    operation: 'get' | 'set' | 'increment',
    key: string,
    error: string,
    meta?: Record<string, unknown>
  ): void {
    if (this.hasLoggedStoreFailure) {
      return;
    }

    this.hasLoggedStoreFailure = true;
    this.logger.warn('CacheStore', 'Upstash operation failed, using in-memory fallback by policy', {
      operation,
      key,
      error,
      ...(meta ?? {}),
    });
  }
}
