import type { TestProject } from 'vitest/node';

import { specimen } from '../../__fixtures__/specimen-mobile/specimen.js';
import { startAppiumDouble } from './server.js';

export default async function setup(
    project: TestProject,
): Promise<(() => Promise<void>) | undefined> {
    if (process.env.TEST_MOBILE_APPIUM_URL !== undefined) {
        return undefined;
    }
    const double = await startAppiumDouble(specimen);
    project.provide('appiumDouble', double.url);
    // invariant: a spawned Appium server of the run is a stub forwarding here.
    process.env.APPIUM_DOUBLE_URL = double.url;
    return async () => {
        await double.stop();
        const { created, deleted } = double.sessions;
        process.stdout.write(`appium double: ${created} session(s) created, ${deleted} deleted\n`);
    };
}
