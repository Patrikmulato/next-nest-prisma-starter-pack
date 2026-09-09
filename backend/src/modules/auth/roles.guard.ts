import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AccessTokenPayload, AuthenticatedRequest } from './auth.types.js';
import { ROLES_KEY } from './decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly reflector: Reflector;

  constructor(@Inject(Reflector) reflector: Reflector) {
    this.reflector = reflector;
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Array<AccessTokenPayload['role']>>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userRole = request.user?.role;

    if (userRole && requiredRoles.includes(userRole)) {
      return true;
    }

    throw new ForbiddenException('You do not have permission to access this resource');
  }
}
