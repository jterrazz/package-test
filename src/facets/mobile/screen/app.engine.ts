import type { Started } from '../../../kernel/chain/config.js';
import type { MobileConfig } from '../mobile.handle.js';
import type { AppPort } from './app.port.js';

/** Reached at the first open: a file that opens nothing starts no session. */
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
