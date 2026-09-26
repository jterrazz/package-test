import { once } from 'node:events';
import { createServer } from 'node:http';
import { describe, expect, onTestFinished, test } from 'vitest';

import { http } from '../../../src/index.js';
import { quoteOrder } from '../../shared/fixtures/orders/orders.js';
import { integration } from '../pure.specification.js';

const PRICING = 'https://pricing.spec.test';

/** It starts a 503 body and holds it open. */
async function heldReply(): Promise<number> {
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
    return address.port;
}

describe('passthrough-cancel', () => {
    test(
        'passed through to a real server after a chain, its body settles a cancel',
        { timeout: 3000 },
        async () => {
            // Given - a chain that started the network double, and a server holding its body open
            await integration
                .intercept(http.get(`${PRICING}/quotes/ORD-1`), http.json({ total: 42 }))
                .call(async () => await quoteOrder(PRICING, 'ORD-1'));
            const port = await heldReply();

            // When - a module fetches it with no stub declared, and cancels the body unread
            const result = await integration.call(async () => {
                const reply = await fetch(`http://127.0.0.1:${port}/quote`);
                await reply.body?.cancel();
                return reply.status;
            });

            // Then - the cancel settled, and the status is the one the server wrote
            expect(result.value).toMatch(503);
        },
    );
});
