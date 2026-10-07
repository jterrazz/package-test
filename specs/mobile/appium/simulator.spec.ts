import { directory } from '@jterrazz/test';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli as vitestCli } from '../../cli/vitest-cli.specification.js';

/** It prints the sessions it saw, and the simulator windows they would have opened, when the run is over. */
const DOUBLE_SETUP = resolve(import.meta.dirname, '../../__setup__/appium/per-run.ts');

const ON_THE_DOUBLE = { DOUBLE_SETUP, TEST_MOBILE_APPIUM_URL: null };

function alive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function pidsIn(content: string): number[] {
    return content
        .split('\n')
        .filter((line) => line !== '')
        .map(Number);
}

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

    test('a run that ends leaves no WebDriverAgent of its simulator behind', async () => {
        // Given - a scratch project whose run spawns its Appium server, which starts a WebDriverAgent outside its group for the session
        const result = await vitestCli
            .fixture(directory('./__fixtures__/mobile-spawned-session/'))
            .env(ON_THE_DOUBLE)
            .exec('run --configLoader runner');
        const webDriverAgent = pidsIn(result.file('app/webdriveragent').content);

        // Then - the run passed, and its xcodebuild and runner app ended with its server
        expect(result.exitCode).toBe(0);
        expect(webDriverAgent).toHaveLength(2);
        expect(webDriverAgent.filter((pid) => alive(pid))).toStrictEqual([]);
    });

    test('a run killed with SIGKILL leaves no WebDriverAgent of its simulator behind', async () => {
        // Given - the same project, whose file SIGKILLs its own vitest and worker once its session is open, teardown never reached
        const result = await vitestCli
            .fixture(directory('./__fixtures__/mobile-spawned-session/'))
            .fixture(directory('./__fixtures__/mobile-killed-session/'))
            .env(ON_THE_DOUBLE)
            .exec('run --configLoader runner', { timeout: 60_000 });
        const webDriverAgent = pidsIn(result.file('app/webdriveragent').content);

        // Then - the xcodebuild and runner app die with the run, within the stop grace and a poll
        expect(result.exitCode).not.toBe(0);
        expect(webDriverAgent).toHaveLength(2);
        await expect
            .poll(() => webDriverAgent.filter((pid) => alive(pid)), { timeout: 5000 })
            .toStrictEqual([]);
    });
});
