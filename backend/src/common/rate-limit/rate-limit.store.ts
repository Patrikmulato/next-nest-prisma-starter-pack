import { Injectable } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service.js';
import { getAppConfig } from '../../config/app.config.js';

type HitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

type MemoryBucket = {
  count: number;
  resetAtMs: number;
};

const MEMORY_BUCKET_SOFT_LIMIT = 3000;
const UPSTASH_REQUEST_TIMEOUT_MS = 2000;

@Injectable()
export class RateLimitStore {
  private readonly memoryBuckets = new Map<string, MemoryBucket>();
  private readonly logger: LoggerService;
  private hasLoggedMissingStore = false;
  private hasLoggedStoreFailure = false;

  constructor(logger: LoggerService = new LoggerService()) {
    this.logger = logger;
  }

  async hit(key: string, maxRequests: number, windowMs: number): Promise<HitResult> {
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!upstashUrl || !upstashToken) {
      if (this.shouldFailClosed()) {
        throw new Error('Upstash Redis store is required by the fail-closed rate-limit policy');
      }

      this.warnMissingStoreOnce();
      return this.hitInMemory(key, maxRequests, windowMs);
    }

    try {
      return await this.hitUpstash(key, maxRequests, windowMs, upstashUrl, upstashToken);
    } catch (error: unknown) {
      if (this.shouldFailClosed()) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown Upstash error';
      this.warnStoreFailureOnce(key, message);
      return this.hitInMemory(key, maxRequests, windowMs);
    }
  }

  private warnMissingStoreOnce(): void {
    if (this.hasLoggedMissingStore) {
      return;
    }

    this.hasLoggedMissingStore = true;
    this.logger.warn('RateLimitStore', 'Using in-memory fallback by policy', {
      policy: getAppConfig().rateLimitOutagePolicy,
    });
  }

  private warnStoreFailureOnce(key: string, error: string): void {
    if (this.hasLoggedStoreFailure) {
      return;
    }

    this.hasLoggedStoreFailure = true;
    this.logger.warn('RateLimitStore', 'Upstash hit failed, using in-memory fallback by policy', {
      key,
      error,
    });
  }

  private shouldFailClosed(): boolean {
    return getAppConfig().rateLimitOutagePolicy === 'fail-closed';
  }

  private hitInMemory(key: string, maxRequests: number, windowMs: number): HitResult {
    const nowMs = Date.now();
    const existing = this.memoryBuckets.get(key);

    if (!existing || existing.resetAtMs <= nowMs) {
      const resetAtMs = nowMs + windowMs;
      this.memoryBuckets.set(key, { count: 1, resetAtMs });
      this.gcMemoryBuckets(nowMs);

      return {
        allowed: true,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - 1),
        retryAfterSeconds: Math.ceil(windowMs / 1000),
      };
    }

    existing.count += 1;

    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000));
    const remaining = Math.max(0, maxRequests - existing.count);

    return {
      allowed: existing.count <= maxRequests,
      limit: maxRequests,
      remaining,
      retryAfterSeconds,
    };
  }

  private async hitUpstash(
    key: string,
    maxRequests: number,
    windowMs: number,
    upstashUrl: string,
    upstashToken: string
  ): Promise<HitResult> {
    const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));

    const incrementResult = await this.upstashCommand<number>(
      `${upstashUrl}/incr/${encodeURIComponent(key)}`,
      upstashToken
    );

    if (incrementResult === 1) {
      await this.upstashCommand<number>(
        `${upstashUrl}/expire/${encodeURIComponent(key)}/${ttlSeconds}`,
        upstashToken
      );
    }

    return {
      allowed: incrementResult <= maxRequests,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - incrementResult),
      retryAfterSeconds: ttlSeconds,
    };
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
      throw new Error(`Upstash request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { result?: T };
    if (!('result' in payload)) {
      throw new Error('Upstash response missing result field');
    }

    return payload.result as T;
  }

  private gcMemoryBuckets(nowMs: number): void {
    if (this.memoryBuckets.size <= MEMORY_BUCKET_SOFT_LIMIT) {
      return;
    }

    for (const [key, value] of this.memoryBuckets.entries()) {
      if (value.resetAtMs <= nowMs) {
        this.memoryBuckets.delete(key);
      }
    }
  }
}
