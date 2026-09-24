import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { startMobile } from './mobile.handle.js';

/**
 * The constructor under a declared `appium` server. The device named here
 * exists on no machine, and the root holds no appium binary: a runner that
 * resolved the simulator through `simctl`, or spawned the project's own
 * server, refuses — so a handle coming back IS the proof that it did neither.
 */
const ABSENT_DEVICE = { name: 'No Such Phone', os: '1.0' };

/** A project root with no `node_modules/.bin/appium` in it. */
const bareRoot = (): string => mkdtempSync(join(tmpdir(), 'mobile-root-'));

describe('startMobile — a declared appium server', () => {
    test('connects without resolving, booting or spawning anything', async () => {
        // Given - a server someone else runs, and a project with no appium of its own
        const handle = await startMobile({
            app: { bundleId: 'com.example.app' },
            appium: { url: 'http://127.0.0.1:4723' },
            device: ABSENT_DEVICE,
            root: bareRoot(),
        });

        // Then - no simulator was resolved, so none is named
        expect(handle.udid).toBeUndefined();
        await handle.cleanup();
    });

    test('hands a declared udid through untouched', async () => {
        // Given - a server someone else runs, and the one simulator it should drive
        const handle = await startMobile({
            app: { bundleId: 'com.example.app' },
            appium: { url: 'http://127.0.0.1:4723' },
            device: { ...ABSENT_DEVICE, udid: 'SIM-UDID' },
            root: bareRoot(),
        });

        // Then - the handle names the declared simulator
        expect(handle.udid).toBe('SIM-UDID');
        await handle.cleanup();
    });
});
