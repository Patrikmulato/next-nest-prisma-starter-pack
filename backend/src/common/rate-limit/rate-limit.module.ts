import { Module } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard.js';
import { RateLimitStore } from './rate-limit.store.js';

@Module({
  providers: [RateLimitStore, RateLimitGuard],
  exports: [RateLimitStore, RateLimitGuard],
})
export class RateLimitModule {}
