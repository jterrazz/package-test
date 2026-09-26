import { describe, expect, test } from 'vitest';

import { ORDER_LINE } from '../_setup/requests/order-line.js';
import { cli } from '../cli.specification.js';

describe('listing', () => {
    test('runs orders', async () => {
        // Given - no order placed
        const result = await cli.env({ LINE: ORDER_LINE }).exec('orders');

        // Then - the command succeeds
        expect(result.exitCode).toBe(0);
    });
});
