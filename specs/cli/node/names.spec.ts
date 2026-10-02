import { directory, file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('names', () => {
    test('the names a consumer imports behind each subpath are the recorded surface, and the page build carries every value of the node one', async () => {
        // Given - a consumer's project whose compiler reads the installed declarations, and the page build as the module it is
        const result = await cli.fixture(directory('./_fixtures/consumer/')).exec('node names.mjs');

        // Then - a name that appears or disappears is a change of the public surface, recorded here
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./_expected/names.txt'));
    });
});
