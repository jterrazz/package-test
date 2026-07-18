import { expect, test } from 'vitest';

import { double } from './util.js';

test('doubles', () => {
    // Given - a number
    // Then - doubled
    expect(double(2)).toBe(4);
});
