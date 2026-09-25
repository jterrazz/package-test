import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import type { ProvidedContext } from 'vitest';
import type { TestProject } from 'vitest/node';

import { serveAppium } from '../seams/appium/appium-server.js';
import { endSessions, MOBILE_SESSIONS_DIR } from '../seams/appium/session-ledger.js';

/**
 * The mobile project's global setup: one driver session per run.
 *
 * Before the first file it hands the workers an empty folder of its own —
 * one per project and per run. The first runner that opens the app records
 * its session there and every later file attaches to it. After the last
 * file, it ends every session recorded.
 *
 * A project that declares its device (`mobile({ device, root })`) has this
 * setup own the server too: it boots the simulator, spawns the project's
 * Appium server once for the run and provides both to the workers, and it
 * stops the server after the sessions are ended.
 */
/** What the setup reads of the project: its root, what it declared, and the channel to its workers. */
type SessionProject = Pick<TestProject, 'provide'> & {
    config: { provide?: Partial<ProvidedContext>; root: string };
};

export default async function setup(project: SessionProject): Promise<() => Promise<void>> {
    const directory = join(project.config.root, MOBILE_SESSIONS_DIR, randomUUID());
    project.provide('mobileSessions', directory);
    const declared = project.config.provide?.mobileAppium;
    const served =
        declared === undefined
            ? undefined
            : await serveAppium(declared.device, resolve(project.config.root, declared.root));
    if (declared !== undefined && served !== undefined) {
        project.provide('mobileServer', {
            device: declared.device,
            udid: served.udid,
            url: served.server.url,
        });
    }
    return async () => {
        await endSessions(directory);
        await served?.server.stop();
    };
}
