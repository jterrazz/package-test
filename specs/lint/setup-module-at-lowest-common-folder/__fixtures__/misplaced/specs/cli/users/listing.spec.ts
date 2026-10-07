import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';
import { CURRENCY } from '../__setup__/currency.js';
import { TENANT } from '../__setup__/tenant.js';
import { NOW } from '../orders/__setup__/clock.js';

describe('listing', () => {
    test('runs users', async () => {
        // Given - no user signed up
        const result = await cli.exec('users');

        // Then - the command succeeds, over what the setup holds
        expect(result.exitCode).toBe(0);
        expect(NOW).toBeDefined();
        expect(CURRENCY).toBeDefined();
        expect(TENANT).toBeDefined();
    });
});
