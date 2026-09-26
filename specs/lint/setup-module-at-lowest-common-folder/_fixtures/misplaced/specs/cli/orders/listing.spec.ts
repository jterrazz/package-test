import { describe, expect, test } from 'vitest';

import { LABELS } from '#cli-setup/labels.js';

import { cli } from '../cli.specification.js';
import { FORMAT } from '../_setup/format.js';
import { ROWS } from '../_setup/rows.js';
import { NOW } from './_setup/clock.js';

describe('listing', () => {
    test('runs orders', async () => {
        // Given - no order placed
        const result = await cli.exec('orders');

        // Then - the command succeeds, over what the setup holds
        expect(result.exitCode).toBe(0);
        expect(FORMAT).toBeDefined();
        expect(ROWS).toBeDefined();
        expect(LABELS).toBeDefined();
        expect(NOW).toBeDefined();
    });
});
