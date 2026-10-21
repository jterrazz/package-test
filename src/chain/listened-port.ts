import type { Server } from 'node:net';

import { invariant } from './refusals/refusal.js';

/** Listens, on `host` when one is named, and answers the port it got; a port another server holds rejects with its error. */
export async function listenedPort(
    server: Server,
    { host, port = 0 }: { host?: string; port?: number } = {},
): Promise<number> {
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
            server.off('error', reject);
            resolve();
        });
    });
    const address = server.address();
    // Stryker disable BlockStatement,ConditionalExpression,EqualityOperator,LogicalOperator,StringLiteral: a server listening on a TCP port always answers it
    if (address === null || typeof address === 'string') {
        throw invariant('a server listening on a TCP port answered no port');
    }
    // Stryker restore all
    return address.port;
}
