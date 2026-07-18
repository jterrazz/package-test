import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { shouldUpdateSnapshots } from './update.js';

describe('update-mode detection (CONVENTIONS D5/E1)', () => {
    let savedArgv: string[];
    let savedTestUpdate: string | undefined;

    beforeEach(() => {
        // Given - a clean env/argv slate, restored after each test
        savedArgv = [...process.argv];
        savedTestUpdate = process.env.TEST_UPDATE;
        delete process.env.TEST_UPDATE;
        process.argv = process.argv.filter((arg) => arg !== '-u' && arg !== '--update');
    });

    afterEach(() => {
        process.argv = savedArgv;
        if (savedTestUpdate === undefined) {
            delete process.env.TEST_UPDATE;
        } else {
            process.env.TEST_UPDATE = savedTestUpdate;
        }
    });

    test('enables update mode under TEST_UPDATE=1', () => {
        // Given - the framework env var set to its only truthy value
        process.env.TEST_UPDATE = '1';

        // Then - update mode is on
        expect(shouldUpdateSnapshots()).toBe(true);
    });

    test('treats TEST_UPDATE=0 and unset as falsy', () => {
        // Given - no update trigger at all
        // Then - unset is falsy
        expect(shouldUpdateSnapshots()).toBe(false);

        // Given - explicitly disabled
        process.env.TEST_UPDATE = '0';

        // Then - '0' is falsy too (only '1' enables, E1)
        expect(shouldUpdateSnapshots()).toBe(false);
    });

    test('vitest -u and --update argv flags enable update mode', () => {
        // Given - the short flag
        process.argv = [...process.argv, '-u'];

        // Then - update mode is on
        expect(shouldUpdateSnapshots()).toBe(true);

        // Given - the long flag instead
        process.argv = savedArgv.filter((arg) => arg !== '-u' && arg !== '--update');
        process.argv = [...process.argv, '--update'];

        // Then - the long flag enables update mode too
        expect(shouldUpdateSnapshots()).toBe(true);
    });
});
