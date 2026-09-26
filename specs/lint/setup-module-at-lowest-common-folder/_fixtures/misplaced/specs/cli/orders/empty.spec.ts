import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';
import { ROWS } from '../_setup/rows.js';

describe('empty', () => {
    test('runs orders', async () => {
        // Given - an empty table
        const result = await cli.exec('orders');

        // Then - the command succeeds, over what the setup holds
        expect(result.exitCode).toBe(0);
        expect(ROWS).toBeDefined();
    });
});
