import { describe, expect, test } from 'vitest';

import { rows } from '../../_shared/_setup/rows.js';
import { cli } from '../cli.specification.js';

describe('build', () => {
    test('reads the rows', async () => {
        // Given - the shared rows
        const result = await cli.fixture(rows).exec('build');

        // Then - it exits clean
        expect(result.exitCode).toBe(0);
    });
});
