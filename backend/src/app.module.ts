import { APP_GUARD } from '@nestjs/core';
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { LoggerModule } from './common/logger/logger.module.js';
import { CorrelationMiddleware } from './common/middlewares/correlation.middleware.js';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard.js';
import { RateLimitModule } from './common/rate-limit/rate-limit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DataModule } from './modules/data/data.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { SavedFiltersModule } from './modules/saved-filters/saved-filters.module.js';
import { UsefulMapCategoriesModule } from './modules/useful-map-categories/useful-map-categories.module.js';
import { UsefulMapsModule } from './modules/useful-maps/useful-maps.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    LoggerModule,
    DataModule,
    HealthModule,
    PrismaModule,
    UsersModule,
    SavedFiltersModule,
    UsefulMapsModule,
    UsefulMapCategoriesModule,
    AuthModule,
    RateLimitModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
