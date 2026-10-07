import { directory, file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/* invariant: the accessors and matchers are the subject here; the fixture CLI's output is the vehicle. */

describe('copied', () => {
    test('copies fixture file into working dir before exec', async () => {
        // Given - fixture file that triggers check failure
        const result = await cli
            .fixture(directory('../__fixtures__/specimen-cli/'))
            .fixture(file('./__fixtures__/invalid.ts'))
            .exec('check');

        // Then - check detected the invalid file
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('unused-var');
    });

    test('clean project has no invalid files', async () => {
        // Given - the pristine project fixture
        const result = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('check');

        // Then - check passes
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('All checks passed');
    });
});
