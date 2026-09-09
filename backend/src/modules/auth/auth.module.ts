import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module.js';
import { resolveAccessTokenSecret } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [
    RateLimitModule,
    JwtModule.register({
      secret: resolveAccessTokenSecret(),
      signOptions: {
        expiresIn: '1h',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, AuthService],
})
export class AuthModule {}
