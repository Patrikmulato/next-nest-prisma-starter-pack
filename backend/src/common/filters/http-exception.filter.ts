import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getCorrelationId } from '../logger/correlation-context.js';
import { LoggerService } from '../logger/logger.service.js';

export interface ApiErrorResponse {
  success: false;
  error: {
    statusCode: number;
    message: string;
    errors?: string[] | Record<string, unknown>;
  };
  timestamp: string;
  path: string;
  correlationId?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService = new LoggerService()) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] | Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        if (typeof responseObj.message === 'string' || Array.isArray(responseObj.message)) {
          message =
            typeof responseObj.message === 'string'
              ? responseObj.message
              : responseObj.message.join(', ');
        } else {
          message = exception.message;
        }
        errors = responseObj.error
          ? [responseObj.error as string]
          : (responseObj.errors as string[] | undefined);
      } else {
        message = exceptionResponse as string;
      }
    } else if (exception instanceof Error) {
      // Log the real error server-side but do NOT leak internal details to the
      // client; the generic "Internal server error" message above is returned.
      this.logger.error('HttpExceptionFilter', 'Unhandled exception', {
        error: exception.message,
        stack: exception.stack,
        path: request.url,
      });
    }

    const apiErrorResponse: ApiErrorResponse = {
      success: false,
      error: {
        statusCode: status,
        message,
        ...(errors && { errors }),
      },
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId: getCorrelationId(),
    };

    response.status(status).send(apiErrorResponse);
  }
}
