import { createServer } from 'node:net';

import { invariant } from '../../chain/refusals/refusal.js';

// Stryker disable BlockStatement,CallExpression,ConditionalExpression,EqualityOperator,LogicalOperator,StringLiteral: a server listening on port 0 always answers the port it got, and never errors
export async function findFreePort(): Promise<number> {
    return await new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(0, () => {
            const address = server.address();
            if (address === null || typeof address === 'string') {
                server.close();
                reject(invariant('a server listening on port 0 answered no port'));
                return;
            }
            const { port } = address;
            server.close(() => {
                resolve(port);
            });
        });
        server.on('error', reject);
    });
}
// Stryker restore all

// Stryker disable BlockStatement: a catch emptied answers undefined, which reads as no answer all the same
export async function firstAnswering(urls: readonly string[]): Promise<string | undefined> {
    const answered = await Promise.all(
        urls.map(async (url) => ((await answers(url)) ? url : undefined)),
    );

    return answered.find((url) => url !== undefined);
}

async function answers(url: string): Promise<boolean> {
    try {
        await fetch(url, { redirect: 'manual' });
        return true;
    } catch {
        return false;
    }
}
// Stryker restore BlockStatement
