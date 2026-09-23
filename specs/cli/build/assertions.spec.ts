import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

/*
 * This file is the framework's own matcher/accessor self-test: the toContain probes
 * demonstrate the .text/.raw/.file accessors and matcher behaviour themselves —
 * the fixture CLI's output is the vehicle, not the assertion target. Whole-output
 * correctness is exercised by the toMatch(file(…)) golden cases throughout.
 */

describe('assertions', () => {
    test('exists check', async () => {
        // Given - build creates files
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('build');

        // Then - file exists and absent file doesn't
        expect(result.file('dist/index.js').exists).toBeTruthy();
        expect(result.file('dist/nonexistent.js').exists).toBeFalsy();
    });

    test('content check', async () => {
        // Given - build creates files
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('build');

        // Then - file contains expected content
        expect(result.file('dist/index.js').content).toContain('Hello from CLI app');
    });

    test('chains multiple assertions on one result', async () => {
        // Given - a successful build
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('build');

        // Then - several read accessors on one result
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('Build completed');
        expect(result.file('dist/index.js').exists).toBeTruthy();
        expect(result.file('dist/manifest.json').exists).toBeTruthy();
        expect(result.file('dist/index.cjs').exists).toBeFalsy();
        expect(result.file('dist/index.js').content).toContain('Hello from CLI app');
    });
});
