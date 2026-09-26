import { describe, expect, test } from 'vitest';

import { CURRENCY } from './format.js';

describe('format', () => {
    test('names the currency', () => {
        // Given - the shop's currency
        const currency = CURRENCY;

        // Then - euros
        expect(currency).toBe('EUR');
    });
});
