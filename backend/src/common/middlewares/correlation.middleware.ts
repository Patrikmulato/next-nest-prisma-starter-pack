import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { runWithCorrelationId } from '../logger/correlation-context.js';

const CORRELATION_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: IncomingMessage, res: ServerResponse, next: () => void): void {
    const headerValue = req.headers[CORRELATION_HEADER];
    const correlationId =
      typeof headerValue === 'string' && headerValue.trim().length > 0
        ? headerValue.trim()
        : randomUUID();

    res.setHeader(CORRELATION_HEADER, correlationId);

    runWithCorrelationId(correlationId, () => {
      next();
    });
  }
}
