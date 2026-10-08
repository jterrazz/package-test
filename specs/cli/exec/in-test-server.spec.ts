import { createServer } from 'node:http';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('in-test-server', () => {
    test('a one-shot command reaches a server the test itself serves, and prints what it answered', async () => {
        // Given - a server listening in the test's own process, its address handed to the binary
        await using server = await listening((_request, response) => {
            response.end('answered by the test');
        });
        const result = await cli
            .env({ LITERATE_BACKEND_URL: `http://127.0.0.1:${String(server.port)}` })
            .exec('backend-fetch /status');

        // Then - the test's event loop answered while the command ran
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('answered by the test');
    });
});

type Listening = AsyncDisposable & { port: number };

async function listening(handler: Parameters<typeof createServer>[1] & {}): Promise<Listening> {
    const server = createServer(handler);
    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    return {
        async [Symbol.asyncDispose]() {
            await new Promise((resolve) => {
                server.close(resolve);
            });
        },
        port,
    };
}
