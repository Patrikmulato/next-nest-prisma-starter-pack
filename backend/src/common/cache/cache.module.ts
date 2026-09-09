import { Module } from '@nestjs/common';
import { CacheStore } from './cache.store.js';

@Module({
  providers: [CacheStore],
  exports: [CacheStore],
})
export class CacheModule {}
