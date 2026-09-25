import type { StartedWith } from '../../model/chain/config.js';
import type { DeviceScreen, MobileScenario } from '../../model/ports/device.port.js';

/**
 * The installed app a mobile runner declared, opened on the device session
 * its constructor reaches — reached at the first open, never before, so a
 * file that opens nothing starts no driver session.
 */
export function appiumApp({ bundleId, device }: StartedWith<'bundleId' | 'device'>): {
    readonly open: (
        deepLink: string | undefined,
        scenario: MobileScenario | undefined,
    ) => Promise<DeviceScreen>;
} {
    return {
        open: async (deepLink, scenario) => {
            const session = await device();
            return await session.open({ bundleId, deepLink, scenario });
        },
    };
}
