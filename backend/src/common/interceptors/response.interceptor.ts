import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { FastifyRequest } from 'fastify';
import { getCorrelationId } from '../logger/correlation-context.js';

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
  path: string;
  correlationId?: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
        path: request.url,
        correlationId: getCorrelationId(),
      }))
    );
  }
}
