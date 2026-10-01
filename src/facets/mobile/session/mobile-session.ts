import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import type { ProvidedContext } from 'vitest';
import type { TestProject } from 'vitest/node';

import { setupEntry } from '../../../chain/paths/setup-entry.js';
import { serveAppium } from '../server/appium-server.js';
import { endSessions, MOBILE_SESSIONS_DIR } from './session-ledger.js';

type SessionProject = Pick<TestProject, 'provide'> & {
    config: { provide?: Partial<ProvidedContext>; root: string };
};

export function mobileSessionSetup(): string {
    return setupEntry(import.meta.dirname, 'mobile-session.ts', 'mobile-session.js');
}

/** One driver session per run: the first runner records it in the provided folder, later files attach, the teardown ends them. With `mobile({ device, root })` it also owns the Appium server. */
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
