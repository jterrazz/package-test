import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('listing', () => {
    test('runs orders', async () => {
        // Given - no order placed
        const result = await cli.exec('orders');

        // Then - the command succeeds
        expect(result.exitCode).toBe(0);
    });
});
