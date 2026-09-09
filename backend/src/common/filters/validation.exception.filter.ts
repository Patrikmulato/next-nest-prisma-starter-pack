import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getCorrelationId } from '../logger/correlation-context.js';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter<BadRequestException> {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    const statusCode = exception.getStatus();
    const payload = exception.getResponse();

    let message = exception.message;
    let errors: string[] | undefined;

    if (typeof payload === 'object' && payload !== null) {
      const responseObj = payload as Record<string, unknown>;
      if (typeof responseObj.message === 'string') {
        message = responseObj.message;
      }
      if (Array.isArray(responseObj.message)) {
        errors = responseObj.message.filter((item): item is string => typeof item === 'string');
        message = 'Validation failed';
      }
    }

    response.status(statusCode).send({
      success: false,
      error: {
        statusCode,
        message,
        ...(errors && { errors }),
      },
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId: getCorrelationId(),
    });
  }
}
