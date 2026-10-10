import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import { describe, expect, test } from 'vitest';

import { findFreePort, firstAnswering } from '../listening.js';

describe('listening', () => {
    test('findFreePort — a port nobody listens on — is one a server can then bind', async () => {
        // Given - a port asked for
        const port = await findFreePort();

        // When - a server listens on it
        const server = createServer();
        await new Promise<void>((resolve) => {
            server.listen(port, resolve);
        });
        const bound = server.address();
        server.close();

        // Then - it bound the very port it was handed
        expect([port > 0, bound !== null && typeof bound === 'object' && bound.port]).toStrictEqual(
            [true, port],
        );
    });

    test('firstAnswering — the first address that answers at all — is named, whatever status it answers, and none when nothing does', async () => {
        // Given - a server answering 404 and a port nobody listens on
        const server = createHttpServer((_request, response) => {
            response.statusCode = 404;
            response.end();
        });
        await new Promise<void>((resolve) => {
            server.listen(0, '127.0.0.1', resolve);
        });
        const address = server.address();
        const alive = `http://127.0.0.1:${typeof address === 'object' && address !== null ? address.port : 0}/`;
        const dead = `http://127.0.0.1:${await findFreePort()}/`;

        // When - both are asked, in both orders, then the dead one alone
        const found = [
            await firstAnswering([dead, alive]),
            await firstAnswering([alive, dead]),
            await firstAnswering([dead]),
        ];
        server.close();

        // Then - the living one answers either way, and the dead one alone names nothing
        expect(found).toStrictEqual([alive, alive, undefined]);
    });
});
