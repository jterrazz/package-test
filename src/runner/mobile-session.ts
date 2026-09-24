import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';

import { endSessions, MOBILE_SESSIONS_DIR } from '../facets/mobile/session-ledger.js';

/**
 * The mobile project's global setup: one driver session per run.
 *
 * Before the first file it hands the workers an empty folder of its own —
 * one per project and per run. The first runner that opens the app records
 * its session there and every later file attaches to it. After the last
 * file, it ends every session recorded.
 */
/** What the setup reads of the project: its root, and the channel to its workers. */
type SessionProject = Pick<TestProject, 'provide'> & { config: { root: string } };

export default function setup(project: SessionProject): () => Promise<void> {
    const directory = join(project.config.root, MOBILE_SESSIONS_DIR, randomUUID());
    project.provide('mobileSessions', directory);
    return async () => {
        await endSessions(directory);
    };
}
