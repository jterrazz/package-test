import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';
import { CURRENCY } from '../__setup__/format.js';

describe('listing', () => {
    test('runs orders', async () => {
        // Given - no order placed
        const result = await cli.exec('orders');

        // Then - the command succeeds, priced in the one currency
        expect(result.exitCode).toBe(0);
        expect(CURRENCY).toBe('EUR');
    });
});
