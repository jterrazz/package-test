import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { endSessions, sessionLedger } from '../session-ledger.js';

function ledgerFolder(): string {
    const scratch = mkdtempSync(join(tmpdir(), 'session-ledger-'));
    return join(scratch, 'run');
}

async function recordingServer(): Promise<{ requests: string[]; url: string }> {
    const requests: string[] = [];
    const server = createServer((request, response) => {
        requests.push(`${request.method ?? ''} ${request.url ?? ''}`);
        response.end('{"value":null}');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    onTestFinished(() => {
        server.close();
    });
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    return { requests, url: `http://127.0.0.1:${port}` };
}

const IPHONE = { 'appium:deviceName': 'iPhone 17', platformName: 'iOS' };

describe('sessionLedger', () => {
    test('the session ledger — one driver session per run — a later runner finds the session an earlier one recorded, whatever order it spells the capabilities in', () => {
        // Given - a run's ledger holding the session a first runner created
        const ledger = sessionLedger(ledgerFolder());
        const session = {
            capabilities: { platformName: 'iOS' },
            serverUrl: 'http://a',
            sessionId: 's-1',
        };
        ledger.record(IPHONE, session);

        // Then - the same server and capabilities find it, in any order
        expect(
            ledger.lookup('http://a', { platformName: 'iOS', 'appium:deviceName': 'iPhone 17' }),
        ).toStrictEqual([session]);
    });

    test('the session ledger — one driver session per run — another server, or another device, finds nothing', () => {
        // Given - a run's ledger holding one session
        const ledger = sessionLedger(ledgerFolder());
        ledger.record(IPHONE, { capabilities: {}, serverUrl: 'http://a', sessionId: 's-1' });

        // Then - a session is the server's and the capabilities', never another's
        expect(ledger.lookup('http://b', IPHONE)).toStrictEqual([]);
        expect(ledger.lookup('http://a', { ...IPHONE, 'appium:deviceName': 'iPad' })).toStrictEqual(
            [],
        );
    });

    test('the session ledger — one driver session per run — a run that opened nothing has nothing to find, to forget or to end', async () => {
        // Given - the folder the setup handed out, never written to
        const folder = ledgerFolder();
        const ledger = sessionLedger(folder);

        // Then - no session, and forgetting one or ending the run is no error
        expect(ledger.lookup('http://a', IPHONE)).toStrictEqual([]);
        expect(() => {
            ledger.forget('s-1');
        }).not.toThrow();
        await expect(endSessions(folder)).resolves.toBeUndefined();
    });

    test('the session ledger — one driver session per run — a file in the folder that is no whole entry is skipped', () => {
        // Given - a recorded session beside a text file, a null, and copies of it each missing a field or holding one of another kind
        const folder = ledgerFolder();
        const ledger = sessionLedger(folder);
        ledger.record(IPHONE, { capabilities: {}, serverUrl: 'http://a', sessionId: 's-1' });
        const entry = readFileSync(join(folder, 's-1.json'), 'utf8');
        const variants = {
            'capabilities.json': entry.replace('"capabilities":{}', '"capabilities":"iOS"'),
            'missing.json': entry.replace('"sessionId":"s-1",', ''),
            'null.json': 'null',
            'number.json': entry.replace('"sessionId":"s-1"', '"sessionId":1'),
        };
        for (const [name, text] of Object.entries(variants)) {
            writeFileSync(join(folder, name), text);
        }
        writeFileSync(join(folder, 'notes.txt'), 'not json');

        // Then - only the whole entry is found
        expect(ledger.lookup('http://a', IPHONE)).toStrictEqual([
            { capabilities: {}, serverUrl: 'http://a', sessionId: 's-1' },
        ]);
    });

    test('the session ledger — one driver session per run — a forgotten session is found no more, and its replacement is', () => {
        // Given - a run's ledger holding a session its server expired
        const ledger = sessionLedger(ledgerFolder());
        ledger.record(IPHONE, { capabilities: {}, serverUrl: 'http://a', sessionId: 's-1' });

        // When - it is forgotten, and the session opened in its place recorded
        ledger.forget('s-1');
        ledger.record(IPHONE, { capabilities: {}, serverUrl: 'http://a', sessionId: 's-2' });

        // Then - the replacement is the one found
        expect(ledger.lookup('http://a', IPHONE).map(({ sessionId }) => sessionId)).toStrictEqual([
            's-2',
        ]);
    });

    test('the session ledger — one driver session per run — the run ends every session it recorded, then clears the ledger', async () => {
        // Given - two sessions recorded on one server
        const server = await recordingServer();
        const folder = ledgerFolder();
        const ledger = sessionLedger(folder);
        ledger.record(IPHONE, { capabilities: {}, serverUrl: server.url, sessionId: 's-1' });
        ledger.record(IPHONE, { capabilities: {}, serverUrl: server.url, sessionId: 's-2' });

        // When - the run ends
        await endSessions(folder);

        // Then - each was deleted on its server, and the ledger is gone
        expect(server.requests.toSorted()).toStrictEqual([
            'DELETE /session/s-1',
            'DELETE /session/s-2',
        ]);
        expect(existsSync(folder)).toBe(false);
    });

    test('the session ledger — one driver session per run — a server gone before the end of the run does not fail it', async () => {
        // Given - a session recorded on a server nothing answers on
        const folder = ledgerFolder();
        sessionLedger(folder).record(IPHONE, {
            capabilities: {},
            serverUrl: 'http://127.0.0.1:1',
            sessionId: 's-1',
        });

        // When - the run ends
        await endSessions(folder);

        // Then - the ledger is cleared all the same
        expect(existsSync(folder)).toBe(false);
    });
});
