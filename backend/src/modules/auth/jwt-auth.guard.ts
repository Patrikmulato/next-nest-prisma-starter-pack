import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { resolveAccessTokenSecret } from './auth.constants.js';
import type { AccessTokenPayload, AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(JwtService) private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawAuthHeader = request.headers.authorization ?? request.raw.headers.authorization;
    const authHeader = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader;

    if (typeof authHeader !== 'string') {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const [scheme, token] = authHeader.trim().split(/\s+/, 2);
    if (scheme.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: resolveAccessTokenSecret(),
      });
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
