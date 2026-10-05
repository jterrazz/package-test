import type { DeviceScreen, MobileScenario } from '../device/device.port.js';

export type AppPort = {
    /** Terminate and relaunch the app, apply the deep link, run the scenario, capture the final screen. */
    readonly open: (
        deepLink: string | undefined,
        scenario: MobileScenario | undefined,
    ) => Promise<DeviceScreen>;
};
