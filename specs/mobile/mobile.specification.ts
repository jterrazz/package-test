import { process as processService, specification } from '@jterrazz/test';
import { afterAll, inject } from 'vitest';

import { simulator, specimen } from '../shared/fixtures/specimen-mobile/specimen.js';

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
    root: '../shared/fixtures/specimen-mobile',
    services: { notes },
    // The first session on a cold simulator builds WebDriverAgent, which takes minutes.
    timeouts: { action: 5000, launch: 600_000 },
});

export const notesUrl = notes.connectionString;

afterAll(cleanup);

declare module 'vitest' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface; a type alias redeclares the name and every member is lost
    interface ProvidedContext {
        appiumDouble?: string;
    }
}
