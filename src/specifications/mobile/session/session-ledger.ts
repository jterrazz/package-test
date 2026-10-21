import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { VITEST_ARTIFACTS_DIR } from '../../../../lint/kit/project/artifacts.js';
import { isRecord } from '../../../../lint/kit/project/json-shape.js';

type RecordedSession = {
    // invariant: the capabilities the server answered with: what a runner attaching to it hands the driver.
    capabilities: Record<string, unknown>;
    // outside: the Appium server's base URL.
    serverUrl: string;
    sessionId: string;
};

/** A recorded session is the run's to end, not the runner's, and one worker's to drive: two files running at once never drive one app. */
export type SessionLedger = {
    forget: (sessionId: string) => void;
    lookup: (serverUrl: string, requested: Record<string, unknown>) => RecordedSession[];
    /** Keyed by the session's own id, never overwritten: a second session for one server and capabilities is a second record, and the run ends both. */
    record: (requested: Record<string, unknown>, session: RecordedSession) => void;
};

export const SERVER_CALL_TIMEOUT_MS = 10_000;

export const MOBILE_SESSIONS_DIR = `${VITEST_ARTIFACTS_DIR}/mobile-sessions`;

type LedgerEntry = RecordedSession & { key: string };

function keyOf(serverUrl: string, requested: Record<string, unknown>, worker: string): string {
    const sorted = Object.entries(requested).toSorted(([a], [b]) => a.localeCompare(b));
    return JSON.stringify([serverUrl, sorted, worker]);
}

function isEntry(value: unknown): value is LedgerEntry {
    return (
        isRecord(value) &&
        [value.key, value.serverUrl, value.sessionId].every((field) => typeof field === 'string') &&
        isRecord(value.capabilities)
    );
}

// invariant: a run that recorded nothing has no folder.
function entryFiles(directory: string): string[] {
    try {
        return readdirSync(directory).filter((name) => name.endsWith('.json'));
    } catch {
        return [];
    }
}

function entries(directory: string): LedgerEntry[] {
    // Stryker disable StringLiteral: a file read as a Buffer parses as the same text
    const parsed = (name: string): unknown =>
        JSON.parse(readFileSync(join(directory, name), 'utf8'));
    // Stryker restore StringLiteral
    return entryFiles(directory)
        .map((name) => parsed(name))
        .filter((entry) => isEntry(entry));
}

// invariant: a worker runs its files one at a time, so the sessions it records are its own; vitest numbers a run's workers from 1.
export function sessionLedger(
    directory: string,
    worker: string = process.env.VITEST_POOL_ID ?? '',
): SessionLedger {
    return {
        forget: (sessionId) => {
            rmSync(join(directory, `${sessionId}.json`), { force: true });
        },
        lookup: (serverUrl, requested) => {
            const key = keyOf(serverUrl, requested, worker);
            return entries(directory)
                .filter((entry) => entry.key === key)
                .map(({ capabilities, serverUrl: url, sessionId }) => ({
                    capabilities,
                    serverUrl: url,
                    sessionId,
                }));
        },
        record: (requested, session) => {
            const entry: LedgerEntry = {
                ...session,
                key: keyOf(session.serverUrl, requested, worker),
            };
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
                const response = await fetch(`${entry.serverUrl}/session/${entry.sessionId}`, {
                    method: 'DELETE',
                    signal: AbortSignal.timeout(SERVER_CALL_TIMEOUT_MS),
                });
                // Stryker disable next-line OptionalChaining: a response with no body throws here, and the catch takes it as it takes a server gone
                await response.body?.cancel();
            } catch {
                // invariant: the server is gone, and its sessions with it.
            }
        }),
    );
    rmSync(directory, { force: true, recursive: true });
}

// Stryker disable BlockStatement,StringLiteral: only a mobile project's setup provides it, which no module test runs, so every read answers undefined; the mobile specs judge it
export async function mobileSessions(): Promise<string | undefined> {
    try {
        const { inject } = await import('vitest');
        return inject('mobileSessions');
    } catch {
        return undefined;
    }
}
// Stryker restore all

declare module 'vitest' {
    interface ProvidedContext {
        /** Where each mobile runner records the driver session it opened. */
        mobileSessions?: string;
    }
}
