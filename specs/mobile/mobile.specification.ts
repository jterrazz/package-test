import { process as processService, specification } from '@jterrazz/test';
import { afterAll, inject } from 'vitest';

import { simulator, specimen } from '../__fixtures__/specimen-mobile/specimen.js';

/** `make test-mobile` names a real Appium server in `TEST_MOBILE_APPIUM_URL`; without it the run's protocol double answers, and the specs are the same either way. */
const device = process.env.TEST_MOBILE_APPIUM_URL;

const notes = processService({
    command: 'node notes-api.mjs',
    ready: /listening on port (?<port>\d+)/u,
});

export const { backendUrl, cleanup, mobile } = await specification.mobile({
    app: { bundleId: specimen.bundleId },
    appium: { url: device ?? inject('appiumDouble') ?? '' },
    backend: {},
    device: simulator,
    root: '../__fixtures__/specimen-mobile',
    services: { notes },
    // outside: the first session on a cold simulator builds WebDriverAgent, which takes minutes.
    timeouts: { action: 5000, launch: 600_000 },
});

export const notesUrl = notes.connectionString;

afterAll(cleanup);

declare module 'vitest' {
    interface ProvidedContext {
        appiumDouble?: string;
    }
}
