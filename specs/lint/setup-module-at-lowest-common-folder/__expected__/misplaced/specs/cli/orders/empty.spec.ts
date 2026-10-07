import { describe, expect, test } from 'vitest';

import { LABELS } from '#cli-setup/labels.js';

import { cli } from '../cli.specification.js';
import { ROWS } from './__setup__/rows.js';

describe('empty', () => {
    test('runs orders', async () => {
        // Given - an empty table
        const result = await cli.exec('orders');

        // Then - the command succeeds, over what the setup holds
        expect(result.exitCode).toBe(0);
        expect(ROWS).toBeDefined();
        expect(LABELS).toBeDefined();
    });
});
