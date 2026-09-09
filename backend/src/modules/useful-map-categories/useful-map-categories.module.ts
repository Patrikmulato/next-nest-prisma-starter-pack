import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module.js';
import { UsefulMapsModule } from '../useful-maps/useful-maps.module.js';
import { UsefulMapCategoriesController } from './useful-map-categories.controller.js';
import { UsefulMapCategoriesService } from './useful-map-categories.service.js';

@Module({
  imports: [AuthModule, PrismaModule, RateLimitModule, UsefulMapsModule],
  controllers: [UsefulMapCategoriesController],
  providers: [UsefulMapCategoriesService],
})
export class UsefulMapCategoriesModule {}
