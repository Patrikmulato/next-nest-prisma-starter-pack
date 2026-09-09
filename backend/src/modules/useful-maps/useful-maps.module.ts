import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CacheModule } from '../../common/cache/cache.module.js';
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsefulMapsController } from './useful-maps.controller.js';
import { UsefulMapsService } from './useful-maps.service.js';

@Module({
  imports: [AuthModule, CacheModule, PrismaModule, RateLimitModule],
  controllers: [UsefulMapsController],
  providers: [UsefulMapsService],
  exports: [UsefulMapsService],
})
export class UsefulMapsModule {}
