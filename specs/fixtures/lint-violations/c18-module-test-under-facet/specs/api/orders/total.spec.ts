import { expect, test } from 'vitest';

import { total } from '../../../src/total.js';

test('adds the lines', () => {
    // Given - two lines
    const lines = [1, 2];
    // Then - the total is their sum
    expect(total(lines)).toBe(3);
});
