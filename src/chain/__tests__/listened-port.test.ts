import { once } from 'node:events';
import { createServer } from 'node:net';
import type { Server } from 'node:net';
import { afterEach, describe, expect, test } from 'vitest';

import { listenedPort } from '../listened-port.js';

describe('listenedPort', () => {
    const servers: Server[] = [];

    afterEach(async () => {
        for (const server of servers.splice(0)) {
            if (server.listening) {
                server.close();
                await once(server, 'close');
            }
        }
    });

    test('listenedPort — the port a server got — answers the port it listens on, on the host named', async () => {
        // Given - a server asked for any port on loopback
        const server = createServer();
        servers.push(server);

        // When - it listens
        const port = await listenedPort(server, { host: '127.0.0.1' });

        // Then - the port it answers is the one it holds, on loopback, and no listener of the wait is left on the server
        expect([port > 0, server.address(), server.listenerCount('error')]).toStrictEqual([
            true,
            { address: '127.0.0.1', family: 'IPv4', port },
            0,
        ]);
    });

    test('listenedPort — the port a server got — a port another server holds rejects with its error', async () => {
        // Given - a port held on loopback
        const holder = createServer();
        const second = createServer();
        servers.push(holder, second);
        const port = await listenedPort(holder, { host: '127.0.0.1' });

        // When - a second server asks for the same port
        const listening = listenedPort(second, { host: '127.0.0.1', port });

        // Then - it is refused, as the system refuses it
        await expect(listening).rejects.toThrow('EADDRINUSE');
    });
});
