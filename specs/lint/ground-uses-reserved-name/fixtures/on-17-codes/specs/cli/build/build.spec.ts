import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('build', () => {
    test('builds in colour', async () => {
        // Given - an empty working directory
        const result = await cli.exec('build');

        // Then - the colour codes themselves
        // oxlint-disable-next-line jterrazz/d8w-raw-bypass -- asserts the colour codes themselves (a 17.0 id that no longer exists)
        expect(result.stdout.raw).toContain('[31m');
        // checker-disable-next-line c8, d4 -- written by the build (codes that no longer exist)
        expect(result.exitCode).toBe(0);
    });
});
