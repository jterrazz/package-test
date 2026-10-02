import { describe, expect, test } from 'vitest';

import { cli } from '../asymmetric-transform-cli.specification.js';

describe('transform', () => {
    test("stderr is compared through the runner's transform, after the ANSI strip", async () => {
        // Given - a runner whose transform drops " plain", and a command writing a coloured line to stderr
        const result = await cli.exec('ansi-stderr');

        // Then - the comparison reads the line stripped of its escapes, then transformed
        expect(result.stderr).toMatch(`
            red bold
        `);
    });
});
