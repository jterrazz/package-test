import { expect, test } from 'vitest';

import { normalize } from '../../../src/normalize.js';

test('lowercases the key', () => {
    // Given - a mixed-case key
    const key = 'Order-Id';
    // Then - the normal form is lower
    expect(normalize(key)).toBe('order-id');
});
