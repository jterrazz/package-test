import { directory, file, packed } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('names', () => {
    test('the names a consumer imports behind each subpath are the recorded surface, and the page build carries every value of the node one', async () => {
        // Given - a consumer's project whose compiler reads the installed declarations, and the page build as the module it is
        const result = await cli
            .link('@jterrazz/test', packed())
            .link('@vitest/browser-playwright')
            .link('playwright')
            .link('react')
            .link('react-dom')
            .link('vitest-browser-react')
            .link('typescript')
            .fixture(directory('./__fixtures__/consumer/'))
            .exec('names.mjs');

        // Then - a name that appears or disappears is a change of the public surface, recorded here
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./__expected__/names.txt'));
    });
});
