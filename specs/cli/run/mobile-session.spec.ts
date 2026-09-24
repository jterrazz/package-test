import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli as vitestCli } from '../vitest-cli.specification.js';

/** The Appium double served once per run, which prints the sessions it saw when the run is over. */
const DOUBLE_SETUP = resolve(import.meta.dirname, '../../shared/fixtures/appium-double/per-run.ts');

describe('mobile-session', () => {
    test('a mobile() run of two files drives one driver session, ended once the run is over', async () => {
        // Given - a scratch project whose two files each start a mobile runner on the run's one double
        const result = await vitestCli
            .fixture(directory('./fixtures/mobile-session/'))
            .env({ DOUBLE_SETUP })
            .exec('run --configLoader runner');

        // Then - both files passed, over the one session the run opened and ended
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('Tests  2 passed');
        expect(result.stdout.text).toContain('appium double: 1 session(s) created, 1 deleted');
    });
});
