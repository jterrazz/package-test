import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { runDevice, startMobile } from './mobile.handle.js';

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

describe('startMobile — a runner with no device', () => {
    test('is refused when no run serves one, naming the project declaration', async () => {
        // Given - no device, no declared server, and no mobile({ device }) project around the file
        // Then - the constructor refuses before resolving or spawning anything
        await expect(
            startMobile({ app: { bundleId: 'com.example.app' }, root: bareRoot() }),
        ).rejects.toThrow(
            "specification.mobile() names no device, and no mobile({ device }) project serves one — name the simulator with `device: { name }`, or declare it once on the project, mobile({ device, root }), so every file drives the run's",
        );
    });

    test('is refused under a declared server, which is handed its device by capabilities', async () => {
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

describe('runDevice — the device the run serves', () => {
    /** The run's server, booted for an iPhone 17 on iOS 26.5. */
    const run = {
        device: { name: 'iPhone 17', os: '26.5' },
        udid: 'SIM-17',
        url: 'http://127.0.0.1:4723',
    };

    test("a specification restating the project's device drives the booted simulator", () => {
        // Given - the same name, the os left out
        // Then - the project's device, on the udid the setup booted
        expect(runDevice({ name: 'iPhone 17' }, run)).toStrictEqual({
            name: 'iPhone 17',
            os: '26.5',
            udid: 'SIM-17',
        });
    });

    test("a specification naming no device drives the project's, on the booted simulator", () => {
        // Given - no device on the specification
        // Then - the project's device, on the udid the setup booted
        expect(runDevice(undefined, run)).toStrictEqual({
            name: 'iPhone 17',
            os: '26.5',
            udid: 'SIM-17',
        });
    });

    test("a specification spelling the project's os another way drives the booted simulator", () => {
        // Given - the os with its platform, in another case, where the project wrote the bare version
        // Then - the same runtime, so the project's device on the booted udid
        expect(runDevice({ name: 'iPhone 17', os: 'IOS 26.5' }, run)).toStrictEqual({
            name: 'iPhone 17',
            os: '26.5',
            udid: 'SIM-17',
        });
        expect(
            runDevice(
                { name: 'iPhone 17', os: '26.5' },
                { ...run, device: { name: 'iPhone 17', os: 'iOS 26.5' } },
            ),
        ).toStrictEqual({ name: 'iPhone 17', os: 'iOS 26.5', udid: 'SIM-17' });
    });

    test('a specification naming another device is refused, naming both', () => {
        // Given - another name, the same name on another os or platform, an os the run cannot confirm, another udid
        // Then - each is refused with the device the run drives
        expect(() => runDevice({ name: 'iPad Pro' }, run)).toThrow(
            "specification.mobile() names the device 'iPad Pro', and the run's Appium server drives 'iPhone 17' (26.5) [SIM-17], the device its mobile({ device }) project declares — name that device, or declare no device on mobile() so each file serves its own",
        );
        expect(() => runDevice({ name: 'iPhone 17', os: '18.0' }, run)).toThrow(
            "names the device 'iPhone 17' (18.0)",
        );
        expect(() =>
            runDevice(
                { name: 'iPhone 17', os: 'tvOS 26.5' },
                { ...run, device: { name: 'iPhone 17', os: 'iOS 26.5' } },
            ),
        ).toThrow("names the device 'iPhone 17' (tvOS 26.5)");
        expect(() =>
            runDevice({ name: 'iPhone 17', os: '26.5' }, { ...run, device: { name: 'iPhone 17' } }),
        ).toThrow("names the device 'iPhone 17' (26.5)");
        expect(() => runDevice({ name: 'iPhone 17', udid: 'SIM-OTHER' }, run)).toThrow(
            "names the device 'iPhone 17' [SIM-OTHER]",
        );
    });
});
