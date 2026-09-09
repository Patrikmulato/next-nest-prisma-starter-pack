import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CacheModule } from '../../common/cache/cache.module.js';
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module.js';
import { SavedFiltersController } from './saved-filters.controller.js';
import { SavedFiltersService } from './saved-filters.service.js';

@Module({
  imports: [AuthModule, CacheModule, RateLimitModule],
  controllers: [SavedFiltersController],
  providers: [SavedFiltersService],
  exports: [SavedFiltersService],
})
export class SavedFiltersModule {}
