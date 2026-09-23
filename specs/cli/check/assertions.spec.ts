import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

/*
 * This file is the framework's own matcher/accessor self-test: the toContain probes
 * demonstrate the .text/.raw/.file accessors and matcher behaviour themselves —
 * the fixture CLI's output is the vehicle, not the assertion target. Whole-output
 * correctness is exercised by the toMatch(file(…)) golden cases throughout.
 */

describe('assertions', () => {
    test('copies fixture file into working dir before exec', async () => {
        // Given - fixture file that triggers check failure
        const result = await cli
            .fixture(directory('../../fixtures/cli-app/'))
            .fixture(file('./fixtures/invalid.ts'))
            .exec('check');

        // Then - check detected the invalid file
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('unused-var');
    });

    test('clean project has no invalid files', async () => {
        // Given - the pristine project fixture
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('check');

        // Then - check passes
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('All checks passed');
    });
});
