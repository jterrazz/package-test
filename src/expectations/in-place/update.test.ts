import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { shouldUpdateSnapshots } from './update.js';

function unsetEnv(name: string): void {
    // oxlint-disable-next-line unicorn/no-useless-undefined -- vi.stubEnv deletes a variable when handed undefined, and the argument is required
    vi.stubEnv(name, undefined);
}

function givenArgv(...flags: string[]): void {
    const saved = process.argv;
    process.argv = [...saved.filter((arg) => arg !== '-u' && arg !== '--update'), ...flags];
    onTestFinished(() => {
        process.argv = saved;
    });
}

describe('update', () => {
    test('shouldUpdateSnapshots — enables update mode under TEST_UPDATE=1', () => {
        // Given - the framework env var set to its only truthy value, and no update flag
        givenArgv();
        vi.stubEnv('TEST_UPDATE', '1');

        // Then - update mode is on
        expect(shouldUpdateSnapshots()).toBe(true);
    });

    test('shouldUpdateSnapshots — treats TEST_UPDATE unset as falsy', () => {
        // Given - no update trigger at all
        givenArgv();
        unsetEnv('TEST_UPDATE');

        // Then - unset is falsy
        expect(shouldUpdateSnapshots()).toBe(false);
    });

    test('shouldUpdateSnapshots — treats TEST_UPDATE=0 as falsy: only 1 enables (`environment-read-allow-listed`)', () => {
        // Given - explicitly disabled
        givenArgv();
        vi.stubEnv('TEST_UPDATE', '0');

        // Then - '0' is falsy
        expect(shouldUpdateSnapshots()).toBe(false);
    });

    test.each(['-u', '--update'])(
        'shouldUpdateSnapshots — the vitest %s flag enables update mode',
        (flag) => {
            // Given - the flag on the command line, and no env var
            givenArgv(flag);
            unsetEnv('TEST_UPDATE');

            // Then - update mode is on
            expect(shouldUpdateSnapshots()).toBe(true);
        },
    );
});
