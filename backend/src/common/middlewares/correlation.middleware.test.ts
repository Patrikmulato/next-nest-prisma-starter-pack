import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CorrelationMiddleware } from './correlation.middleware.js';

type HeaderBag = Record<string, string | Array<string> | undefined>;

type MockRequest = Pick<IncomingMessage, 'headers'>;

type MockResponse = {
  setHeader: (name: string, value: number | string | ReadonlyArray<string>) => void;
};

function createResponseCapture(): {
  response: MockResponse;
  getHeader: (name: string) => string | undefined;
} {
  const headers = new Map<string, string>();

  return {
    response: {
      setHeader: (name: string, value: number | string | ReadonlyArray<string>): void => {
        const normalized = Array.isArray(value) ? value.join(',') : String(value);
        headers.set(name, normalized);
      },
    },
    getHeader: (name: string) => headers.get(name),
  };
}

describe('CorrelationMiddleware', () => {
  it('reuses incoming correlation id when provided', () => {
    const middleware = new CorrelationMiddleware();
    const req: MockRequest = {
      headers: {
        'x-correlation-id': '  incoming-id  ',
      } as HeaderBag,
    };

    const { response, getHeader } = createResponseCapture();
    let nextCalled = false;

    middleware.use(req as IncomingMessage, response as ServerResponse, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(getHeader('x-correlation-id'), 'incoming-id');
  });

  it('generates a correlation id when header is missing', () => {
    const middleware = new CorrelationMiddleware();
    const req: MockRequest = { headers: {} as HeaderBag };

    const { response, getHeader } = createResponseCapture();

    middleware.use(req as IncomingMessage, response as ServerResponse, () => {
      // no-op
    });

    const correlationId = getHeader('x-correlation-id');
    assert.equal(typeof correlationId, 'string');
    assert.ok(correlationId);
    assert.ok((correlationId ?? '').length > 10);
  });

  it('generates a correlation id when header is blank', () => {
    const middleware = new CorrelationMiddleware();
    const req: MockRequest = {
      headers: {
        'x-correlation-id': '   ',
      } as HeaderBag,
    };

    const { response, getHeader } = createResponseCapture();

    middleware.use(req as IncomingMessage, response as ServerResponse, () => {
      // no-op
    });

    const correlationId = getHeader('x-correlation-id');
    assert.equal(typeof correlationId, 'string');
    assert.ok(correlationId);
    assert.ok(correlationId !== '');
  });
});
