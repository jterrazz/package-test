import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('passes', () => {
    test('a golden one test reads and a module test reads too is shared, and passes', async () => {
        // Given - the module-read-golden tree
        const result = await checker.fixture(directory('./__fixtures__/module-read-golden/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a pool fixture one leaf reads and a module test names piece by piece is shared, and passes', async () => {
        // Given - the module-read-pieces tree
        const result = await checker.fixture(directory('./__fixtures__/module-read-pieces/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a pool fixture one leaf and a module test outside specs/ both read is shared, and passes', async () => {
        // Given - the module-read tree
        const result = await checker.fixture(directory('./__fixtures__/module-read/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test("a pool fixture a runner and the member's vitest config both name passes", async () => {
        // Given - the config-read tree
        const result = await checker.fixture(directory('./__fixtures__/config-read/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('seeds, a body past its cap, a tree, a fixture, a golden named outside a test and a banner no literal survives stay files', async () => {
        // Given - the kept tree
        const result = await checker.fixture(directory('./__fixtures__/kept/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a pool fixture two leaves share passes', async () => {
        // Given - the shared tree
        const result = await checker.fixture(directory('./__fixtures__/shared/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
