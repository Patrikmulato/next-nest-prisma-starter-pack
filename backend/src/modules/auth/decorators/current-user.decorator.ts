import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AccessTokenPayload, AuthenticatedRequest } from '../auth.types.js';

export const CurrentUser = createParamDecorator(
  (
    data: keyof AccessTokenPayload | undefined,
    context: ExecutionContext
  ): AccessTokenPayload | AccessTokenPayload[keyof AccessTokenPayload] | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!data) {
      return user;
    }

    return user?.[data];
  }
);
