import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { openSession } from './driver-session.js';
import { sessionLedger } from './session-ledger.js';

async function appiumHolding(live: Set<string>): Promise<string> {
    const server = createServer((incoming, response) => {
        const probed = /^\/session\/(?<id>[^/]+)\/timeouts$/u.exec(incoming.url ?? '');
        const id = probed?.groups?.id;
        const alive = id !== undefined && live.has(id);
        response.writeHead(alive ? 200 : 404, { 'content-type': 'application/json' });
        response.end(
            alive
                ? '{"value":{"implicit":0}}'
                : '{"value":{"error":"invalid session id","message":"","stacktrace":""}}',
        );
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    onTestFinished(() => {
        server.close();
    });
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    return `http://127.0.0.1:${port}`;
}

type Calls = { asked: Record<string, unknown>[]; attached: string[]; created: number };

function session(sessionId: string): { capabilities: Record<string, unknown>; sessionId: string } {
    return { capabilities: { platformName: 'iOS' }, sessionId };
}

/** Cast at the seam: a stub session carries only id and capabilities. */
function stubFactories(): { attach: never; calls: Calls; remote: never } {
    const calls: Calls = { asked: [], attached: [], created: 0 };
    const remote = async (options: { capabilities: Record<string, unknown> }) => {
        calls.asked.push(options.capabilities);
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

function request(
    serverUrl: string,
    factories: { attach: never; remote: never },
    ledger?: ReturnType<typeof sessionLedger>,
) {
    return {
        ...factories,
        bundleId: 'com.example.app',
        device: { name: 'iPhone 17' },
        launchTimeoutMs: 240_000,
        ledger,
        serverUrl,
    };
}

function runLedger(): ReturnType<typeof sessionLedger> {
    const scratch = mkdtempSync(join(tmpdir(), 'appium-session-'));
    return sessionLedger(join(scratch, 'run'));
}

describe('openSession', () => {
    test("openSession — the run's one session — the first runner of a run creates the session and records it, a later one attaches to it", async () => {
        // Given - the run's ledger, and two runners asking one server for the same device
        const serverUrl = await appiumHolding(new Set(['s-1']));
        const ledger = runLedger();
        const factories = stubFactories();

        // When - each opens its session
        const first = await openSession(request(serverUrl, factories, ledger));
        const second = await openSession(request(serverUrl, factories, ledger));

        // Then - one session was created, the second runner drove it, and both hold it as the run's
        expect(factories.calls).toMatchObject({ attached: ['s-1'], created: 1 });
        expect([first.shared, second.shared]).toStrictEqual([true, true]);
    });

    test("openSession — the run's one session — a runner outside a run that shares one creates a session of its own", async () => {
        // Given - no ledger
        const serverUrl = await appiumHolding(new Set());
        const factories = stubFactories();

        // When - two runners open their sessions
        const first = await openSession(request(serverUrl, factories));
        await openSession(request(serverUrl, factories));

        // Then - each created its own, and holds it as its own to end
        expect(factories.calls).toMatchObject({ attached: [], created: 2 });
        expect(first.shared).toBe(false);
    });

    test("openSession — the run's one session — a later runner replaces the recorded session the server no longer holds, and records the new one", async () => {
        // Given - a run whose recorded session the server expired
        const live = new Set<string>();
        const serverUrl = await appiumHolding(live);
        const ledger = runLedger();
        const factories = stubFactories();
        await openSession(request(serverUrl, factories, ledger));

        // When - two later runners open their sessions, the replacement still held
        await openSession(request(serverUrl, factories, ledger));
        live.add('s-2');
        await openSession(request(serverUrl, factories, ledger));

        // Then - the second created a session in place of the dead one, the third drove it
        expect(factories.calls).toMatchObject({ attached: ['s-2'], created: 2 });
    });

    test("openSession — the run's one session — a recorded session the probe cannot confirm is ended before it is replaced", async () => {
        // Given - a server that fails the probe of the recorded session
        const deleted: string[] = [];
        const server = createServer((incoming, response) => {
            if (incoming.method === 'DELETE') {
                deleted.push(incoming.url ?? '');
            }
            response.writeHead(incoming.method === 'DELETE' ? 200 : 500);
            response.end('{"value":null}');
        });
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        onTestFinished(() => {
            server.close();
        });
        const address = server.address();
        const port = typeof address === 'object' && address !== null ? address.port : 0;
        const serverUrl = `http://127.0.0.1:${port}`;
        const ledger = runLedger();
        const factories = stubFactories();
        await openSession(request(serverUrl, factories, ledger));

        // When - a later runner opens its session
        await openSession(request(serverUrl, factories, ledger));

        // Then - the unconfirmed session was ended, and a new one created in its place
        expect(deleted).toStrictEqual(['/session/s-1']);
        expect(factories.calls).toMatchObject({ attached: [], created: 2 });
    });

    test('openSession — the session it asks for — states an idle budget that outlives the gap between two files', async () => {
        // Given - a runner on a server
        const serverUrl = await appiumHolding(new Set());
        const factories = stubFactories();

        // When - it opens its session
        await openSession(request(serverUrl, factories));

        // Then - the server keeps it through five idle minutes
        expect(factories.calls.asked[0]?.['appium:newCommandTimeout']).toBe(300);
    });
});
