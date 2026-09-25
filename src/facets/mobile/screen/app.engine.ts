import type { Started } from '../../../kernel/chain/config.js';
import type { MobileConfig } from '../mobile.handle.js';
import type { AppPort } from './app.port.js';

/**
 * The installed app a mobile runner declared, opened on the device session
 * its constructor reaches — reached at the first open, never before, so a
 * file that opens nothing starts no driver session.
 */
export function appiumApp({
    bundleId,
    device,
}: Started<MobileConfig, 'bundleId' | 'device'>): AppPort {
    return {
        open: async (deepLink, scenario) => {
            const session = await device();
            return await session.open({ bundleId, deepLink, scenario });
        },
    };
}
