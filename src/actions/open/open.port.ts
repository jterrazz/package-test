import type { DeviceScreen, MobileScenario } from '../../model/ports/device.port.js';

/** The app a mobile chain opens — the only way `.open()` reaches the device. */
export type AppPort = {
    /**
     * Terminate and relaunch the app, apply the deep link, run the scenario,
     * and capture the final screen.
     */
    readonly open: (
        deepLink: string | undefined,
        scenario: MobileScenario | undefined,
    ) => Promise<DeviceScreen>;
};
