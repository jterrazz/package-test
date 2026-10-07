import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';
import { ROWS } from './__setup__/rows.js';
import { NOW } from '../__setup__/clock.js';

describe('listing', () => {
    test('runs orders', async () => {
        // Given - no order placed
        const result = await cli.exec('orders');

        // Then - the command succeeds, over what the setup holds
        expect(result.exitCode).toBe(0);
        expect(ROWS).toBeDefined();
        expect(NOW).toBeDefined();
    });
});
