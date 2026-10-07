import { describe, expect, test } from 'vitest';

import { rows } from '../../__setup__/rows.js';
import { job } from '../job.specification.js';

describe('refresh', () => {
    test('reads the rows', async () => {
        // Given - the shared rows
        const result = await job.fixture(rows).exec('refresh');

        // Then - it exits clean
        expect(result.exitCode).toBe(0);
    });
});
