import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { startMobile } from './mobile.handle.js';

/** Names a device no machine has, with no appium binary in the root: a handle coming back proves neither `simctl` nor a spawn ran. */
const ABSENT_DEVICE = { name: 'No Such Phone', os: '1.0' };

const bareRoot = (): string => mkdtempSync(join(tmpdir(), 'mobile-root-'));

describe('startMobile', () => {
    test('mobile.handle — startMobile — a declared appium server — connects without resolving, booting or spawning anything', async () => {
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

    test('mobile.handle — startMobile — a declared appium server — hands a declared udid through untouched', async () => {
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

    test('mobile.handle — startMobile — a runner with no device — is refused when no run serves one, naming the project declaration', async () => {
        // Given - no device, no declared server, and no mobile({ device }) project around the file
        // Then - the constructor refuses before resolving or spawning anything
        await expect(
            startMobile({ app: { bundleId: 'com.example.app' }, root: bareRoot() }),
        ).rejects.toThrow(
            [
                'found: specification.mobile() names no device, and no mobile({ device }) project serves one',
                'why: A mobile spec drives one simulator, named by the runner or by its project.',
                "fix: name the simulator with `device: { name }`, or declare it once on the project, mobile({ device, root }), so every file drives the run's",
                'read: docs/11-mobile.md#one-session-per-run',
            ].join('\n'),
        );
    });

    test('mobile.handle — startMobile — a runner with no device — is refused under a declared server, which is handed its device by capabilities', async () => {
        // Given - a server someone else runs, and no device to ask it for
        // Then - the constructor refuses, naming the server
        await expect(
            startMobile({
                app: { bundleId: 'com.example.app' },
                appium: { url: 'http://127.0.0.1:4723' },
                root: bareRoot(),
            }),
        ).rejects.toThrow(
            'specification.mobile() names no device to ask the Appium server at http://127.0.0.1:4723 for',
        );
    });
});
