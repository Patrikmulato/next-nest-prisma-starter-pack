import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashPassword, verifyPassword } from './password-hash.js';

const VALID_SAMPLE_INPUT = 'fixture-input-123';
const INVALID_SAMPLE_INPUT = 'fixture-input-999';

describe('password-hash', () => {
  it('hashes and verifies a valid password', async () => {
    const encoded = await hashPassword(VALID_SAMPLE_INPUT);

    assert.ok(encoded.startsWith('scrypt$'));
    assert.equal(await verifyPassword(VALID_SAMPLE_INPUT, encoded), true);
  });

  it('returns false for wrong password', async () => {
    const encoded = await hashPassword(VALID_SAMPLE_INPUT);

    assert.equal(await verifyPassword(INVALID_SAMPLE_INPUT, encoded), false);
  });

  it('returns false for malformed hash payloads', async () => {
    assert.equal(await verifyPassword('abc', 'sha256$abc$def'), false);
    assert.equal(await verifyPassword('abc', 'scrypt$$'), false);
    assert.equal(await verifyPassword('abc', 'scrypt$only-salt'), false);
  });
});
