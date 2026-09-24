import { once } from 'node:events';
import { createServer } from 'node:http';
import { describe, expect, onTestFinished, test } from 'vitest';

import { ensureContractServer, stopContractServer } from './server.js';

describe('contract server — a reply no contract answered', () => {
    test(
        'passed through to a real server, its body settles a cancel',
        { timeout: 3000 },
        async () => {
            // Given - a local server that starts a 503 body and holds it open, reached while the engine listens with no handler
            const upstream = createServer((_request, response) => {
                response.writeHead(503, { 'content-type': 'application/json' });
                response.write('{"error":');
            });
            onTestFinished(() => {
                upstream.closeAllConnections();
                upstream.close();
            });
            upstream.listen(0, '127.0.0.1');
            await once(upstream, 'listening');
            const address = upstream.address();
            if (address === null || typeof address === 'string') {
                throw new Error('the upstream server has no port');
            }
            await ensureContractServer();
            onTestFinished(stopContractServer);
            const reply = await fetch(`http://127.0.0.1:${address.port}/quote`);

            // Then - the cancel resolves, and the status is the one the server wrote
            await expect(reply.body?.cancel()).resolves.toBeUndefined();
            expect(reply.status).toBe(503);
        },
    );
});
