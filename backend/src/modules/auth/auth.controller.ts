import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { isOriginAllowed } from '../../app-setup.js';
import { getAppConfig } from '../../config/app.config.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { AuthService } from './auth.service.js';
import type { AccessTokenPayload } from './auth.types.js';
import { getRefreshTokenCookieOptions, REFRESH_TOKEN_COOKIE_NAME } from './auth.constants.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator.js';

@Controller('auth')
export class AuthController {
  private readonly authService: AuthService;

  constructor(@Inject(AuthService) authService: AuthService) {
    this.authService = authService;
  }

  private assertAllowedOrigin(request: FastifyRequest): void {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://geo-helpers.vercel.app',
      'https://geo-helpers-backend.vercel.app',
      getAppConfig().corsOrigin,
      getAppConfig().frontendUrl,
    ].filter((origin): origin is string => Boolean(origin));

    const origin = request.headers.origin;
    if (typeof origin !== 'string' || !isOriginAllowed(origin, allowedOrigins)) {
      throw new ForbiddenException('Invalid request origin');
    }
  }

  private setRefreshCookie(reply: FastifyReply, refreshToken: string): void {
    reply.setCookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getRefreshTokenCookieOptions());
  }

  private clearRefreshCookie(reply: FastifyReply): void {
    reply.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      path: getRefreshTokenCookieOptions().path,
    });
  }

  @Post('register')
  @RateLimit(10, 60_000)
  async register(
    @Res({ passthrough: true }) reply: FastifyReply,
    // The global ValidationPipe can't infer the @Body() metatype in this build
    // (no emitted design:paramtypes metadata), so it silently skips validation
    // unless the expected type is passed explicitly here.
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: RegisterDto,
      })
    )
    body: RegisterDto
  ): Promise<AuthResponseDto> {
    const session = await this.authService.register(body);
    this.setRefreshCookie(reply, session.refreshToken);
    return session.response;
  }

  @Post('login')
  @RateLimit(10, 60_000)
  async login(
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        expectedType: LoginDto,
      })
    )
    body: LoginDto
  ): Promise<AuthResponseDto> {
    const session = await this.authService.login(body);
    this.setRefreshCookie(reply, session.refreshToken);
    return session.response;
  }

  @Post('refresh')
  @RateLimit(20, 60_000)
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ): Promise<AuthResponseDto> {
    this.assertAllowedOrigin(request);

    const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE_NAME];
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Missing refresh token');
    }

    const session = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(reply, session.refreshToken);
    return session.response;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: AccessTokenPayload): { id: string; email: string; role: string } {
    return {
      id: user.sub,
      email: user.email,
      role: user.role,
    };
  }

  @RateLimit(30, 60_000)
  @Post('logout')
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ): Promise<{ revoked: true }> {
    this.assertAllowedOrigin(request);

    // Logout must succeed even when the access token has expired, so it is not
    // guarded by JwtAuthGuard. Identity for server-side revocation comes from the
    // refresh cookie; the cookie is always cleared regardless of its validity.
    const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE_NAME];
    this.clearRefreshCookie(reply);

    if (refreshToken && typeof refreshToken === 'string') {
      await this.authService.logoutByRefreshToken(refreshToken);
    }

    return { revoked: true };
  }
}
