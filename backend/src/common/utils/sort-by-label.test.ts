import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { sortByLabel } from './sort-by-label.js';

describe('sortByLabel', () => {
  it('sorts items case-insensitively by label', () => {
    const items = [
      { label: 'zebra', value: 1 },
      { label: 'Apple', value: 2 },
      { label: 'banana', value: 3 },
    ];

    const result = sortByLabel(items);

    assert.deepEqual(result, [
      { label: 'Apple', value: 2 },
      { label: 'banana', value: 3 },
      { label: 'zebra', value: 1 },
    ]);
  });

  it('does not mutate the input array', () => {
    const items = [
      { label: 'C', value: 1 },
      { label: 'A', value: 2 },
    ];
    const original = [...items];

    sortByLabel(items);

    assert.deepEqual(items, original);
  });
});
