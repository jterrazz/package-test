import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('loading', () => {
    test('runs seeds', async () => {
        // Given - no seed filed
        const result = await cli.exec('seeds');

        // Then - the command succeeds
        expect(result.exitCode).toBe(0);
    });
});
