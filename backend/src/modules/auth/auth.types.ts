import type { FastifyRequest } from 'fastify';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: 'USER' | 'CREATOR' | 'ADMIN';
  iat?: number;
  exp?: number;
};

export type AuthenticatedRequest = FastifyRequest & {
  user?: AccessTokenPayload;
};
