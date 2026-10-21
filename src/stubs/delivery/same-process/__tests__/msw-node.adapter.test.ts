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

async function realServer(reached: string[] = []): Promise<string> {
    const server = createServer((request, response) => {
        reached.push(`${request.method} ${request.url}`);
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

async function textOf(url: string, method = 'GET'): Promise<string> {
    const response = await fetch(url, { method });
    return await response.text();
}

describe('mswNode', () => {
    test('msw-node — arming — a chain with no stub arms nothing', async () => {
        // Given - a chain that declared no stub
        // Then - nothing armed: no release, no violation
        await expect(mswNode.arm([])).resolves.toStrictEqual({});
    });

    test("msw-node — arming — a chain's stubs answer until released, and a call none declared is its violation", async () => {
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

    test('msw-node — arming — a method off the HTTP parser is refused while armed, never sent, and the first one refused is the violation', async () => {
        // Given - a stub server started by this test, a real server counting what reaches it, and a chain armed with a PATCH stub of its route
        await stopStubServer();
        const reached: string[] = [];
        const real = await realServer(reached);
        const armed = await mswNode.arm([
            defineStub({ request: http.patch(`${real}/order`), response: http.text('patched') }),
        ]);

        // When - the subject sends the route as `PATCH`, as `patch`, then as `FOO`, and the chain releases
        const upper = await textOf(`${real}/order`, 'PATCH');
        const lower = await fetch(`${real}/order`, { method: 'patch' });
        await fetch(`${real}/order`, { method: 'FOO' });
        const violation = armed.violation?.()?.message.split('\n');
        armed.release?.();

        // Then - the stub answered the capitals, a 501 named the lower case, the first refused is the violation, and the real server saw none of them
        expect([upper, lower.status, await lower.text(), violation, reached]).toStrictEqual([
            'patched',
            501,
            `{"error":"@jterrazz/test strict stubs: unreadable request patch ${real}/order"}`,
            [
                `found: an outgoing request the network double cannot read off the wire, patch ${real}/order: its method is not one of node's \`http.METHODS\`, so no stub could answer it and it would reach the network`,
                "why: From its first stub, a chain's network is strict: every outgoing request matches a declared stub.",
                'fix: send a method in the capitals the HTTP parser reads (`PATCH`, not `patch`): fetch upper-cases DELETE, GET, HEAD, OPTIONS, POST and PUT, and sends any other as written',
                'read: docs/reference/linting.md#network-strict-after-first-stub',
            ],
            [],
        ]);
    });

    test('msw-node — arming — a method off the HTTP parser goes to the network once nothing is armed', async () => {
        // Given - a real server, and a chain armed then released
        const real = await realServer();
        const armed = await mswNode.arm([
            defineStub({ request: http.get(`${real}/today`), response: http.text('stubbed') }),
        ]);
        armed.release?.();

        // When - the subject sends a lower-case `patch`
        const reply = await fetch(`${real}/today`, { method: 'patch' });

        // Then - the real server's own parser refused it, unguarded: a bare 400, no stub's 501
        expect([reply.status, await reply.text()]).toStrictEqual([400, '']);
    });
});
