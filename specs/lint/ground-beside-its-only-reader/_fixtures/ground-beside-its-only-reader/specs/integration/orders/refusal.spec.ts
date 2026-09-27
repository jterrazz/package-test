import { describe, expect, test } from 'vitest';

import { integration } from '../integration.specification.js';

describe('refusal', () => {
test('refuses an order that does not exist', async () => {
    // Given - an order nobody placed
    const result = await integration.call(() => {
        throw new Error('no such order');
    });
    // Then - the call is refused
    expect(result.error).toMatch('no such order');
});
});
