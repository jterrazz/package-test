import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { runDevice, startAppiumServer } from './appium-server.js';

/** The run's server, booted for an iPhone 17 on iOS 26.5. */
const run = {
    device: { name: 'iPhone 17', os: '26.5' },
    udid: 'SIM-17',
    url: 'http://127.0.0.1:4723',
};

describe('appium-server', () => {
    test('startAppiumServer — refuses a root with no appium binary, naming the install command', async () => {
        // Given - a project root where appium was never installed (the run's temp root removes it)
        const root = mkdtempSync(resolve(tmpdir(), 'appium-root-'));

        // Then - the refusal is the exact fix, and nothing is spawned
        await expect(startAppiumServer(root)).rejects.toThrow(
            'npm install -D appium webdriverio && npx appium driver install xcuitest',
        );
    });

    test("runDevice — the device the run serves — a specification restating the project's device drives the booted simulator", () => {
        // Given - the same name, the os left out
        // Then - the project's device, on the udid the setup booted
        expect(runDevice({ name: 'iPhone 17' }, run)).toStrictEqual({
            name: 'iPhone 17',
            os: '26.5',
            udid: 'SIM-17',
        });
    });

    test("runDevice — the device the run serves — a specification naming no device drives the project's, on the booted simulator", () => {
        // Given - no device on the specification
        // Then - the project's device, on the udid the setup booted
        expect(runDevice(undefined, run)).toStrictEqual({
            name: 'iPhone 17',
            os: '26.5',
            udid: 'SIM-17',
        });
    });

    test("runDevice — the device the run serves — a specification spelling the project's os another way drives the booted simulator", () => {
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

    test('runDevice — the device the run serves — a specification naming another device is refused, naming both', () => {
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
