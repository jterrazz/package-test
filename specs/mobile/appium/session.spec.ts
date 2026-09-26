import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli as vitestCli } from '../../cli/vitest-cli.specification.js';

/** It prints the sessions it saw when the run is over. */
const DOUBLE_SETUP = resolve(import.meta.dirname, '../../_shared/_setup/appium/per-run.ts');

const ON_THE_DOUBLE = { DOUBLE_SETUP, TEST_MOBILE_APPIUM_URL: null };

describe('session', () => {
    test('a mobile() run of two files drives one driver session, ended once the run is over', async () => {
        // Given - a scratch project whose two files each start a mobile runner on the run's one double
        const result = await vitestCli
            .fixture(directory('./_fixtures/mobile-session/'))
            .env(ON_THE_DOUBLE)
            .exec('run --configLoader runner');

        // Then - both files passed, over the one session the run opened and ended
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('Tests  2 passed');
        expect(result.stdout.text).toContain('appium double: 1 session(s) created, 1 deleted');
    });

    test('a run whose project declares the device spawns one server, and its files drive one session', async () => {
        // Given - a scratch project declaring its simulator and appium root, and two files naming no device and spawning no server
        const result = await vitestCli
            .fixture(directory('./_fixtures/mobile-spawned-session/'))
            .env(ON_THE_DOUBLE)
            .exec('run --configLoader runner');

        // Then - both files passed, over the one session the run's own server opened on the booted simulator, then stopped
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('Tests  2 passed');
        expect(result.stdout.text).toContain('appium double: 1 session(s) created, 1 deleted');
        expect(result.file('app/udid').content).toBe('SIM-17\n');
        expect(result.file('app/stopped').exists).toBe(true);
    });
});
