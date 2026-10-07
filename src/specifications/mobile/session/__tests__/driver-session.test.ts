import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import type { MobileDevice } from '../../device/device.port.js';
import { openSession } from '../driver-session.js';
import { sessionLedger } from '../session-ledger.js';

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

type Options = Record<string, unknown> & { capabilities: Record<string, unknown> };

type Calls = {
    asked: Record<string, unknown>[];
    attached: string[];
    created: number;
    options: Options[];
};

function session(sessionId: string): { capabilities: Record<string, unknown>; sessionId: string } {
    return { capabilities: { platformName: 'iOS' }, sessionId };
}

/** Cast at the seam: a stub session carries only id and capabilities. */
function stubFactories(): { calls: Calls; webdriverio: never } {
    const calls: Calls = { asked: [], attached: [], created: 0, options: [] };
    const remote = async (options: Options) => {
        calls.options.push(options);
        calls.asked.push(options.capabilities);
        calls.created += 1;
        return session(`s-${calls.created}`);
    };
    const attach = async (options: Options & { sessionId: string }) => {
        calls.options.push(options);
        calls.attached.push(options.sessionId);
        return session(options.sessionId);
    };
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a stub implements the two calls opening a session makes, never webdriverio's whole type
    return { calls, webdriverio: { attach, remote } as never };
}

const IPHONE: MobileDevice = { name: 'iPhone 17' };

function request(
    serverUrl: string,
    factories: { webdriverio: never },
    ledger?: ReturnType<typeof sessionLedger>,
    device: MobileDevice = IPHONE,
) {
    return {
        bundleId: 'com.example.app',
        device,
        launchTimeoutMs: 240_000,
        ledger,
        serverUrl,
        webdriverio: factories.webdriverio,
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

        // Then - one session was created, the second runner drove it with the capabilities the server answered, and both hold it as the run's
        const { port } = new URL(serverUrl);
        expect([factories.calls.options.at(-1), first.shared, second.shared]).toStrictEqual([
            {
                capabilities: { platformName: 'iOS' },
                hostname: '127.0.0.1',
                logLevel: 'error',
                port: Number(port),
                sessionId: 's-1',
            },
            true,
            true,
        ]);
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

        // Then - the second created a session in place of the dead one, which the ledger forgot, and the third drove it
        expect([
            factories.calls.attached,
            factories.calls.created,
            ledger
                .lookup(serverUrl, factories.calls.asked[0] ?? {})
                .map(({ sessionId }) => sessionId),
        ]).toStrictEqual([['s-2'], 2, ['s-2']]);
    });

    test("openSession — the run's one session — a runner probes every session recorded for its server and device before it creates one", async () => {
        // Given - two sessions recorded for one device, the first expired, the second still held
        const serverUrl = await appiumHolding(new Set(['s-9']));
        const ledger = runLedger();
        const factories = stubFactories();
        await openSession(request(serverUrl, factories, ledger));
        ledger.record(factories.calls.asked[0] ?? {}, {
            capabilities: {},
            serverUrl,
            sessionId: 's-9',
        });

        // When - a later runner opens its session
        await openSession(request(serverUrl, factories, ledger));

        // Then - it drove the held one, and created nothing more
        expect(factories.calls).toMatchObject({ attached: ['s-9'], created: 1 });
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

    test('openSession — the session it asks for — names the device by name, bare version and udid when given, with an idle budget that outlives the gap between two files, its simulator headless', async () => {
        // Given - a device named with its OS, spaced, and udid, one by name alone, and one whose OS only ends in the platform's name
        const serverUrl = await appiumHolding(new Set());
        const factories = stubFactories();

        // When - each opens its session
        await openSession(
            request(serverUrl, factories, undefined, {
                name: 'iPhone 17',
                os: 'iOS  26.5',
                udid: 'SIM-UDID',
            }),
        );
        await openSession(request(serverUrl, factories));
        await openSession(
            request(serverUrl, factories, undefined, { name: 'iPhone 17', os: 'radios 1' }),
        );

        // Then - the capabilities each asked for, on the server's host and port
        const asked = {
            'appium:automationName': 'XCUITest',
            'appium:bundleId': 'com.example.app',
            'appium:deviceName': 'iPhone 17',
            'appium:isHeadless': true,
            'appium:newCommandTimeout': 300,
            'appium:noReset': true,
            'appium:wdaLaunchTimeout': 240_000,
            platformName: 'iOS',
        };
        expect(factories.calls.options).toStrictEqual([
            {
                capabilities: {
                    ...asked,
                    'appium:platformVersion': '26.5',
                    'appium:udid': 'SIM-UDID',
                },
                hostname: '127.0.0.1',
                logLevel: 'error',
                port: Number(new URL(serverUrl).port),
            },
            {
                capabilities: asked,
                hostname: '127.0.0.1',
                logLevel: 'error',
                port: Number(new URL(serverUrl).port),
            },
            {
                capabilities: { ...asked, 'appium:platformVersion': 'radios 1' },
                hostname: '127.0.0.1',
                logLevel: 'error',
                port: Number(new URL(serverUrl).port),
            },
        ]);
    });

    test('openSession — the session it asks for — shows the simulator under TEST_MOBILE_HEADED=1 alone', async () => {
        // Given - a server, and the run's environment asking to watch, then naming another value
        const serverUrl = await appiumHolding(new Set());
        const factories = stubFactories();
        onTestFinished(() => {
            vi.unstubAllEnvs();
        });

        // When - a session is opened under each
        vi.stubEnv('TEST_MOBILE_HEADED', '1');
        await openSession(request(serverUrl, factories));
        vi.stubEnv('TEST_MOBILE_HEADED', 'true');
        await openSession(request(serverUrl, factories));

        // Then - only the first asked for its simulator in a window
        expect(factories.calls.asked.map((asked) => asked['appium:isHeadless'])).toStrictEqual([
            false,
            true,
        ]);
    });
});
