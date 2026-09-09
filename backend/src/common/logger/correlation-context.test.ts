import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getCorrelationId, runWithCorrelationId } from './correlation-context.js';

describe('correlation-context', () => {
  it('returns undefined when no correlation context is active', () => {
    assert.equal(getCorrelationId(), undefined);
  });

  it('returns correlation id inside runWithCorrelationId scope', () => {
    const value = runWithCorrelationId('cid-123', () => getCorrelationId());

    assert.equal(value, 'cid-123');
  });
});
