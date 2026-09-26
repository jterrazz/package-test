import { describe, expect, test } from 'vitest';

import type { DeviceOpenOptions, DevicePort, MobileScenario } from '../device/device.port.js';
import { appiumApp } from './app.driver.js';

const scenario: MobileScenario = async () => {
    await Promise.resolve();
};

describe('appiumApp', () => {
    test('appiumApp — the installed app a mobile chain opens — reaches the device session at the first open, and relaunches the declared bundle on it', async () => {
        // Given - a runner's lazy device accessor, counting the sessions it is asked for
        const opened: DeviceOpenOptions[] = [];
        let reached = 0;
        const session: DevicePort = {
            close: async () => {
                await Promise.resolve();
            },
            open: async (options) => {
                opened.push(options);
                return await Promise.resolve({ texts: [], tree: { type: 'Application' } });
            },
        };
        const app = appiumApp({
            bundleId: 'com.example.app',
            device: async () => {
                reached += 1;
                return await Promise.resolve(session);
            },
        });
        expect(reached).toBe(0);

        // When - a chain opens a deep link with a scenario
        await app.open('specimen://notes', scenario);

        // Then - the session was reached then, and the app it relaunched is the declared bundle
        expect(reached).toBe(1);
        expect(opened).toStrictEqual([
            { bundleId: 'com.example.app', deepLink: 'specimen://notes', scenario },
        ]);
    });
});
