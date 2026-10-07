import { directory } from '@jterrazz/test';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli as vitestCli } from '../../cli/vitest-cli.specification.js';

/** It prints the sessions it saw, and the simulator windows they would have opened, when the run is over. */
const DOUBLE_SETUP = resolve(import.meta.dirname, '../../__setup__/appium/per-run.ts');

const ON_THE_DOUBLE = { DOUBLE_SETUP, TEST_MOBILE_APPIUM_URL: null };

describe('simulator', () => {
    test('a run drives its simulator headless, and opens no window', async () => {
        // Given - a scratch project whose two files drive the run's one double
        const result = await vitestCli
            .fixture(directory('./__fixtures__/mobile-session/'))
            .env(ON_THE_DOUBLE)
            .exec('run --configLoader runner');

        // Then - its one session asked for a headless simulator
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain(
            'appium double: 1 session(s) created, 1 deleted, 0 simulator window(s) opened',
        );
    });

    test('a run under TEST_MOBILE_HEADED=1 shows its simulator in a window', async () => {
        // Given - the same project, run by someone who wants to watch
        const result = await vitestCli
            .fixture(directory('./__fixtures__/mobile-session/'))
            .env({ ...ON_THE_DOUBLE, TEST_MOBILE_HEADED: '1' })
            .exec('run --configLoader runner');

        // Then - its one session asked for the simulator's window
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain(
            'appium double: 1 session(s) created, 1 deleted, 1 simulator window(s) opened',
        );
    });
});
