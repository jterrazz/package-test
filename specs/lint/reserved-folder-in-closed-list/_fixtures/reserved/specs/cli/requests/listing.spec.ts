import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('listing', () => {
    test('runs requests', async () => {
        // Given - no request filed
        const result = await cli.exec('requests');

        // Then - the command succeeds
        expect(result.exitCode).toBe(0);
    });
});
