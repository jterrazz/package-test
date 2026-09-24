import { process as processService, specification } from '@jterrazz/test';
import { afterAll, inject } from 'vitest';

import { simulator, specimen } from '../shared/fixtures/specimen-mobile/specimen.js';

/**
 * The mobile runner, over Specimen. `make test-mobile` names a real Appium
 * server driving an iOS simulator in `TEST_MOBILE_APPIUM_URL`; without it,
 * the run answers from the protocol double the project's global setup serves
 * once for the whole run, which draws the same app from data. The specs are
 * the same either way.
 */
const device = process.env.TEST_MOBILE_APPIUM_URL;

/** The API the notes screen reads, started beside the app. */
const notes = processService({
    command: 'node notes-api.mjs',
    ready: /listening on port (?<port>\d+)/u,
});

export const { backendUrl, cleanup, mobile } = await specification.mobile({
    app: { bundleId: specimen.bundleId },
    appium: { url: device ?? inject('appiumDouble') ?? '' },
    backend: {},
    device: simulator,
    // The app's own folder: the commands its services run are the app's.
    root: '../shared/fixtures/specimen-mobile',
    services: { notes },
    // A verb gives the app five seconds to draw what it names; the first
    // Session on a cold simulator builds WebDriverAgent, which takes minutes.
    timeouts: { action: 5000, launch: 600_000 },
});

/** Where the notes service answers — the `api` a deep link hands the app. */
export const notesUrl = notes.connectionString;

afterAll(cleanup);

/** Where the protocol double the run's global setup serves answers (`appium-double/per-run.ts`). */
declare module 'vitest' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface; a type alias redeclares the name and every member is lost
    interface ProvidedContext {
        /** Where the run's Appium protocol double answers. */
        appiumDouble?: string;
    }
}
