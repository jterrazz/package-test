import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { VITEST_ARTIFACTS_DIR } from '../../../kernel/files/artifacts.js';
import type { RecordedSession, SessionLedger } from '../device/device.port.js';

/**
 * The run's driver sessions, kept on disk so every file of a `mobile()` run
 * drives the ONE session the first file opened.
 *
 * The project's global setup hands the workers an empty folder. The first
 * runner to open the app creates its session and records it there; every
 * later runner asking the same server for the same capabilities attaches to
 * it instead of creating one. The setup's teardown ends every recorded
 * session once the last file has run. A session is recorded under its own
 * id, so two runners that open one each (files run in parallel) leave two
 * records, and both are ended — none leaks.
 */

/** Where the session folders of a run sit, below the project root. */
export const MOBILE_SESSIONS_DIR = `${VITEST_ARTIFACTS_DIR}/mobile-sessions`;

/** A recorded session, with the key a later runner must match to attach to it. */
type LedgerEntry = RecordedSession & { key: string };

/** The key a session is matched on: the same server, asked for the same capabilities. */
function keyOf(serverUrl: string, requested: Record<string, unknown>): string {
    const sorted = Object.entries(requested).toSorted(([a], [b]) => (a < b ? -1 : 1));
    return JSON.stringify([serverUrl, sorted]);
}

function isEntry(value: unknown): value is LedgerEntry {
    return (
        typeof value === 'object' &&
        value !== null &&
        'key' in value &&
        typeof value.key === 'string' &&
        'serverUrl' in value &&
        typeof value.serverUrl === 'string' &&
        'sessionId' in value &&
        typeof value.sessionId === 'string' &&
        'capabilities' in value &&
        typeof value.capabilities === 'object'
    );
}

/** Every session the run recorded into `directory`. */
function entries(directory: string): LedgerEntry[] {
    if (!existsSync(directory)) {
        return [];
    }
    return readdirSync(directory)
        .filter((name) => name.endsWith('.json'))
        .map((name): unknown => JSON.parse(readFileSync(join(directory, name), 'utf8')))
        .filter((entry) => isEntry(entry));
}

/** The ledger a runner reads and writes, kept in the folder the global setup provided. */
export function sessionLedger(directory: string): SessionLedger {
    return {
        lookup: (serverUrl, requested) => {
            const key = keyOf(serverUrl, requested);
            const found = entries(directory).find((entry) => entry.key === key);
            return found === undefined
                ? undefined
                : {
                      capabilities: found.capabilities,
                      serverUrl: found.serverUrl,
                      sessionId: found.sessionId,
                  };
        },
        record: (requested, session) => {
            const entry: LedgerEntry = { ...session, key: keyOf(session.serverUrl, requested) };
            mkdirSync(directory, { recursive: true });
            writeFileSync(
                join(directory, `${session.sessionId}.json`),
                `${JSON.stringify(entry)}\n`,
            );
        },
    };
}

/**
 * End every session the run recorded, then remove the folder. A server that
 * no longer answers has taken its sessions with it: its refusal is not the
 * run's failure.
 */
export async function endSessions(directory: string): Promise<void> {
    await Promise.all(
        entries(directory).map(async (entry) => {
            try {
                await fetch(`${entry.serverUrl}/session/${entry.sessionId}`, { method: 'DELETE' });
            } catch {
                // The server is gone, and its sessions with it.
            }
        }),
    );
    rmSync(directory, { force: true, recursive: true });
}

/** Where the run records its driver sessions — what the mobile project's global setup provides to its workers. */
declare module 'vitest' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface; a type alias redeclares the name and every member is lost
    interface ProvidedContext {
        /** Where each mobile runner records the driver session it opened. */
        mobileSessions?: string;
    }
}
