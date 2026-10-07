import { directory } from '@jterrazz/test';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli as vitestCli } from '../../cli/vitest-cli.specification.js';

/** It prints the sessions it saw when the run is over. */
const DOUBLE_SETUP = resolve(import.meta.dirname, '../../__setup__/appium/per-run.ts');

const ON_THE_DOUBLE = { DOUBLE_SETUP, TEST_MOBILE_APPIUM_URL: null };

describe('session', () => {
    test('a mobile() run of two files drives one driver session, ended once the run is over', async () => {
        // Given - a scratch project whose two files each start a mobile runner on the run's one double
        const result = await vitestCli
            .fixture(directory('./__fixtures__/mobile-session/'))
            .env(ON_THE_DOUBLE)
            .exec('run --configLoader runner');

        // Then - both files passed, over the one session the run opened and ended
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('Tests  2 passed');
        expect(result.stdout.text).toContain('appium double: 1 session(s) created, 1 deleted');
    });

    test('a run whose session the server expired opens another in its place for the next runner, and ends it', async () => {
        // Given - a scratch project whose second runner opens once the double expired the session the first one drove
        const result = await vitestCli
            .fixture(directory('./__fixtures__/mobile-expired-session/'))
            .env(ON_THE_DOUBLE)
            .exec('run --configLoader runner');

        // Then - the second runner drove a session of its own, not the dead one, and the run ended it
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('Tests  1 passed');
        expect(result.stdout.text).toContain('appium double: 2 session(s) created, 2 deleted');
    });

    test('a run whose project declares the device spawns one server, and its files drive one session', async () => {
        // Given - a scratch project declaring its simulator and appium root, and two files naming no device and spawning no server
        const result = await vitestCli
            .fixture(directory('./__fixtures__/mobile-spawned-session/'))
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
