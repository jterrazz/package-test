import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { VITEST_ARTIFACTS_DIR } from '../../../../lint/engine/project/artifacts.js';

type RecordedSession = {
    /** The capabilities the server answered with — what a runner attaching to it hands the driver. */
    capabilities: Record<string, unknown>;
    /** The Appium server's base URL. */
    serverUrl: string;
    /** The W3C session id. */
    sessionId: string;
};

/** A recorded session is the run's to end, not the runner's. */
export type SessionLedger = {
    forget: (sessionId: string) => void;
    lookup: (serverUrl: string, requested: Record<string, unknown>) => RecordedSession[];
    /** Keyed by the session's own id, never overwritten: a second session for one server and capabilities is a second record, and the run ends both. */
    record: (requested: Record<string, unknown>, session: RecordedSession) => void;
};

export const MOBILE_SESSIONS_DIR = `${VITEST_ARTIFACTS_DIR}/mobile-sessions`;

type LedgerEntry = RecordedSession & { key: string };

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

function entries(directory: string): LedgerEntry[] {
    if (!existsSync(directory)) {
        return [];
    }
    return readdirSync(directory)
        .filter((name) => name.endsWith('.json'))
        .map((name): unknown => JSON.parse(readFileSync(join(directory, name), 'utf8')))
        .filter((entry) => isEntry(entry));
}

export function sessionLedger(directory: string): SessionLedger {
    return {
        forget: (sessionId) => {
            rmSync(join(directory, `${sessionId}.json`), { force: true });
        },
        lookup: (serverUrl, requested) => {
            const key = keyOf(serverUrl, requested);
            return entries(directory)
                .filter((entry) => entry.key === key)
                .map(({ capabilities, serverUrl: url, sessionId }) => ({
                    capabilities,
                    serverUrl: url,
                    sessionId,
                }));
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

/** A server that no longer answers has taken its sessions with it. */
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

export async function mobileSessions(): Promise<string | undefined> {
    try {
        const { inject } = await import('vitest');
        return inject('mobileSessions');
    } catch {
        return undefined;
    }
}

declare module 'vitest' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface; a type alias redeclares the name and every member is lost
    interface ProvidedContext {
        /** Where each mobile runner records the driver session it opened. */
        mobileSessions?: string;
    }
}
