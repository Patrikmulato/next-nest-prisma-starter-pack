import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_METADATA_KEY = 'rateLimit';

export type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

export function RateLimit(maxRequests: number, windowMs: number) {
  return SetMetadata(RATE_LIMIT_METADATA_KEY, {
    maxRequests,
    windowMs,
  } satisfies RateLimitConfig);
}
