import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';
import { CURRENCY } from '../_setup/format.js';

describe('listing', () => {
    test('runs users', async () => {
        // Given - no user signed up
        const result = await cli.exec('users');

        // Then - the command succeeds, priced in the one currency
        expect(result.exitCode).toBe(0);
        expect(CURRENCY).toBe('EUR');
    });
});
