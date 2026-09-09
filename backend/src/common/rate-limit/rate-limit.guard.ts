import { ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../../modules/auth/auth.types.js';
import { RATE_LIMIT_METADATA_KEY, type RateLimitConfig } from './rate-limit.decorator.js';
import { RateLimitStore } from './rate-limit.store.js';

const DEFAULT_LIMIT: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60_000,
};

@Injectable()
export class RateLimitGuard {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RateLimitStore) private readonly store: RateLimitStore
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config =
      this.reflector.getAllAndOverride<RateLimitConfig>(RATE_LIMIT_METADATA_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_LIMIT;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();

    const key = this.buildKey(request);
    const result = await this.store.hit(key, config.maxRequests, config.windowMs);

    response.header('X-RateLimit-Limit', String(result.limit));
    response.header('X-RateLimit-Remaining', String(result.remaining));
    response.header('Retry-After', String(result.retryAfterSeconds));

    if (!result.allowed) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }

  private buildKey(request: AuthenticatedRequest): string {
    const path = request.url;
    const method = request.method;
    const clientIp = this.resolveClientIp(request);

    return `rl:${method}:${path}:${clientIp}`;
  }

  private resolveClientIp(request: AuthenticatedRequest): string {
    const forwardedHeader = request.headers['x-forwarded-for'];

    if (typeof forwardedHeader === 'string' && forwardedHeader.length > 0) {
      const firstIp = forwardedHeader.split(',')[0]?.trim();
      if (firstIp) {
        return firstIp;
      }
    }

    if (Array.isArray(forwardedHeader) && forwardedHeader.length > 0) {
      const firstValue = forwardedHeader[0]?.trim();
      if (firstValue) {
        const firstIp = firstValue.split(',')[0]?.trim();
        if (firstIp) {
          return firstIp;
        }
      }
    }

    if (request.ip) {
      return request.ip;
    }

    return request.raw.socket.remoteAddress ?? 'unknown';
  }
}
