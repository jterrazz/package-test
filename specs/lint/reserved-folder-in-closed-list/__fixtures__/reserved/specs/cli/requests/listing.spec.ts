import { describe, expect, test } from 'vitest';

import { ORDER_LINE } from '../__setup__/requests/order-line.js';
import { cli } from '../cli.specification.js';

describe('listing', () => {
    test('runs requests', async () => {
        // Given - no request filed
        const result = await cli.env({ LINE: ORDER_LINE }).exec('requests');

        // Then - the command succeeds
        expect(result.exitCode).toBe(0);
    });
});
