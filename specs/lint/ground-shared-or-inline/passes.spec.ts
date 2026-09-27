import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('passes', () => {
    test('a golden one test reads and a module test reads too is shared, and passes', async () => {
        // Given - the module-read-golden tree
        const result = await checker.fixture(directory('./_fixtures/module-read-golden/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a pool fixture one leaf reads and a module test names piece by piece is shared, and passes', async () => {
        // Given - the module-read-pieces tree
        const result = await checker.fixture(directory('./_fixtures/module-read-pieces/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a pool fixture one leaf and a module test outside specs/ both read is shared, and passes', async () => {
        // Given - the module-read tree
        const result = await checker.fixture(directory('./_fixtures/module-read/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test("a pool fixture a runner and the member's vitest config both name passes", async () => {
        // Given - the config-read tree
        const result = await checker.fixture(directory('./_fixtures/config-read/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('seeds, a body past its cap, a tree, a fixture and a golden named outside a test stay files', async () => {
        // Given - the kept tree
        const result = await checker.fixture(directory('./_fixtures/kept/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a pool fixture two leaves share passes', async () => {
        // Given - the shared tree
        const result = await checker.fixture(directory('./_fixtures/shared/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
