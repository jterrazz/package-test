import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

describe('tokens', () => {
    test('comparisons see clean text while .raw keeps the escapes', async () => {
        // Given - output wrapped in ANSI escapes, no transform configured
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('ansi');

        // Then - matchers compare the stripped form
        expect(result.stdout.text).toContain('red plain bold');
        expect(result.stdout).toMatch(`
            red plain bold
        `);

        // Then - the raw accessor keeps the escapes
        // oxlint-disable-next-line jterrazz/d8w-raw-bypass -- the raw accessor IS the subject: this test proves it retains ANSI escapes while matchers see the stripped form.
        expect(result.stdout.raw).toContain('\u001B[31m');
    });
});
