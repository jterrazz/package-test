import { process as processService, specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { startAppiumDouble } from '../shared/fixtures/appium-double/server.js';
import { specimen } from '../shared/fixtures/mobile-app/specimen.js';

/**
 * The mobile runner, over Specimen. `TEST_MOBILE_APPIUM_URL` names a real
 * Appium server driving an iOS simulator; without it, the run answers from
 * the protocol double, which draws the same app from data. The specs are the
 * same either way.
 */
const device = process.env.TEST_MOBILE_APPIUM_URL;
const double = device === undefined ? await startAppiumDouble(specimen) : undefined;

/** The API the notes screen reads, started beside the app. */
const notes = processService({
    command: 'node notes-api.mjs',
    ready: /listening on port (?<port>\d+)/u,
});

export const { backendUrl, cleanup, mobile } = await specification.mobile({
    app: { bundleId: specimen.bundleId },
    appium: { url: device ?? double?.url ?? '' },
    backend: {},
    device: { name: 'iPhone 17', os: '26.5' },
    // The app's own folder: the commands its services run are the app's.
    root: '../shared/fixtures/mobile-app',
    services: { notes },
    // A verb gives the app five seconds to draw what it names; the first
    // Session on a cold simulator builds WebDriverAgent, which takes minutes.
    timeouts: { action: 5000, launch: 600_000 },
});

/** Where the notes service answers — the `api` a deep link hands the app. */
export const notesUrl = notes.connectionString;

afterAll(async () => {
    await cleanup();
    await double?.stop();
});
