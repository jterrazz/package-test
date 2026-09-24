import type { TestProject } from 'vitest/node';

import { specimen } from '../mobile-app/specimen.js';
import { startAppiumDouble } from './server.js';

/**
 * The double, served ONCE for a run of a mobile project — a global setup
 * placed before `mobile()`'s own, so the run's session is ended while the
 * double still answers. It provides its URL as `appiumDouble`, and prints the
 * sessions it created and deleted when the run is over. A run that names a
 * real server in `TEST_MOBILE_APPIUM_URL` starts no double.
 */
export default async function setup(project: TestProject): Promise<(() => Promise<void>) | undefined> {
    if (process.env.TEST_MOBILE_APPIUM_URL !== undefined) {
        return undefined;
    }
    const double = await startAppiumDouble(specimen);
    project.provide('appiumDouble', double.url);
    // A spawned Appium server of the run is a stub forwarding here.
    process.env.APPIUM_DOUBLE_URL = double.url;
    return async () => {
        await double.stop();
        const { created, deleted } = double.sessions;
        process.stdout.write(`appium double: ${created} session(s) created, ${deleted} deleted\n`);
    };
}
