import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { sessionLedger } from '../session/session-ledger.js';
import { openSession } from './appium.session.js';

const SERVER_URL = 'http://127.0.0.1:4723';

/** What the stub server was asked: the sessions it created, and the ones attached to. */
type Calls = { attached: string[]; created: number };

/** A stub session: its id, and the capabilities the server answered. */
function session(sessionId: string): { capabilities: Record<string, unknown>; sessionId: string } {
    return { capabilities: { platformName: 'iOS' }, sessionId };
}

/**
 * webdriverio's two factories over a stub server. Cast at the seam: a stub
 * session carries its id and capabilities, not webdriverio's whole type.
 */
function stubFactories(): { attach: never; calls: Calls; remote: never } {
    const calls: Calls = { attached: [], created: 0 };
    const remote = async () => {
        calls.created += 1;
        return await Promise.resolve(session(`s-${calls.created}`));
    };
    const attach = async (options: { sessionId: string }) => {
        calls.attached.push(options.sessionId);
        return await Promise.resolve(session(options.sessionId));
    };
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a stub implements the two calls opening a session makes, never webdriverio's whole type
    return { attach: attach as never, calls, remote: remote as never };
}

/** A request for Specimen on an iPhone, over the stub factories and the given ledger. */
function request(
    factories: { attach: never; remote: never },
    ledger?: ReturnType<typeof sessionLedger>,
) {
    return {
        ...factories,
        bundleId: 'com.example.app',
        device: { name: 'iPhone 17' },
        launchTimeoutMs: 240_000,
        ledger,
        serverUrl: SERVER_URL,
    };
}

describe("openSession — the run's one session", () => {
    test('the first runner of a run creates the session and records it, a later one attaches to it', async () => {
        // Given - the run's ledger, and two runners asking one server for the same device
        const scratch = mkdtempSync(join(tmpdir(), 'appium-session-'));
        const ledger = sessionLedger(join(scratch, 'run'));
        const factories = stubFactories();

        // When - each opens its session
        const first = await openSession(request(factories, ledger));
        const second = await openSession(request(factories, ledger));

        // Then - one session was created, the second runner drove it, and both hold it as the run's
        expect(factories.calls).toStrictEqual({ attached: ['s-1'], created: 1 });
        expect([first.shared, second.shared]).toStrictEqual([true, true]);
    });

    test('a runner outside a run that shares one creates a session of its own', async () => {
        // Given - no ledger
        const factories = stubFactories();

        // When - two runners open their sessions
        const first = await openSession(request(factories));
        await openSession(request(factories));

        // Then - each created its own, and holds it as its own to end
        expect(factories.calls).toStrictEqual({ attached: [], created: 2 });
        expect(first.shared).toBe(false);
    });
});
