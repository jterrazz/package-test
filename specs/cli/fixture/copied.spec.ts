import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

/* The accessors and matchers are the subject here; the fixture CLI's output is the vehicle. */

describe('copied', () => {
    test('copies fixture file into working dir before exec', async () => {
        // Given - fixture file that triggers check failure
        const result = await cli
            .fixture(directory('../_fixtures/specimen-cli/'))
            .fixture(file('./_fixtures/invalid.ts'))
            .exec('check');

        // Then - check detected the invalid file
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('unused-var');
    });

    test('clean project has no invalid files', async () => {
        // Given - the pristine project fixture
        const result = await cli.fixture(directory('../_fixtures/specimen-cli/')).exec('check');

        // Then - check passes
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('All checks passed');
    });
});
