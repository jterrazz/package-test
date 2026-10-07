import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { integration } from '../integration.specification.js';

describe('total', () => {
test('totals the lines of an order', async () => {
    // Given - an order with two lines
    const result = await integration.call(() => ({ total: 3 }));
    // Then - the whole answer is pinned
    expect(result.value).toMatch(file('./__expected__/total.json')); // checker-disable-line ground-shared-or-inline -- an input tree of the checker spec: its file form is what the rule reads
});
});
