import { once } from 'node:events';
import { createServer } from 'node:http';
import { afterAll, describe, expect, onTestFinished, test } from 'vitest';

import { http } from '../../../kinds/http.js';
import { defineStub } from '../../../stub.js';
import { mswNode } from '../msw-node.adapter.js';
import { stopStubServer } from '../stub-server.js';

afterAll(async () => {
    await stopStubServer();
});

async function realServer(): Promise<string> {
    const server = createServer((request, response) => {
        response.end(`real ${request.url}`);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    onTestFinished(() => {
        server.close();
    });
    const address = server.address();
    return typeof address === 'object' && address !== null
        ? `http://127.0.0.1:${address.port}`
        : '';
}

async function textOf(url: string): Promise<string> {
    const response = await fetch(url);
    return await response.text();
}

describe('mswNode', () => {
    test('msw-node — arming — a chain with no stub arms nothing', async () => {
        // Given - a chain that declared no stub
        // Then - nothing armed: no release, no violation
        await expect(mswNode.arm([])).resolves.toStrictEqual({});
    });

    test('msw-node — arming — a chain’s stubs answer until released, and a call none declared is its violation', async () => {
        // Given - a real server, and a chain armed with a stub of one of its routes
        const real = await realServer();
        const armed = await mswNode.arm([
            defineStub({ request: http.get(`${real}/today`), response: http.text('stubbed') }),
        ]);

        // When - the subject makes the declared call and an undeclared one, then the chain releases and calls again
        const answered = await textOf(`${real}/today`);
        await fetch(`${real}/tomorrow`).catch(String);
        const violation = armed.violation?.()?.message ?? '';
        armed.release?.();
        const released = await textOf(`${real}/today`);

        // Then - the stub answered, the undeclared call is named, and the real server answers once released
        expect([answered, violation.includes('/tomorrow'), released]).toStrictEqual([
            'stubbed',
            true,
            'real /today',
        ]);
    });
});
