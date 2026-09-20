import { afterEach, describe, expect, test } from 'vitest';

import { ServeAdapter } from './serve.adapter.js';

let adapter: null | ServeAdapter = null;

afterEach(async () => {
    await adapter?.stop();
    adapter = null;
});

describe('serve adapter', () => {
    test('starts a server on the injected port and reports its base url', async () => {
        // Given - a one-liner HTTP server honoring PORT
        adapter = new ServeAdapter(
            {
                command: `node -e "require('node:http').createServer((q,s)=>s.end('ok')).listen(process.env.PORT)"`,
            },
            process.cwd(),
        );

        // Then - the base url answers
        const baseUrl = await adapter.start();
        const response = await fetch(baseUrl);
        expect(response.status).toBe(200);
    });

    test('fails fast with the captured output when the command dies', async () => {
        // Given - a command that exits immediately
        adapter = new ServeAdapter(
            { command: `node -e "console.error('bad config'); process.exit(1)"`, timeout: 5000 },
            process.cwd(),
        );

        // Then - the error carries the child's own output
        await expect(adapter.start()).rejects.toThrow('bad config');
    });

    test('stop terminates the process group', async () => {
        // Given - a running server
        adapter = new ServeAdapter(
            {
                command: `node -e "require('node:http').createServer((q,s)=>s.end('ok')).listen(process.env.PORT)"`,
            },
            process.cwd(),
        );
        const baseUrl = await adapter.start();

        // When - it is stopped
        await adapter.stop();

        // Then - the port no longer answers
        await expect(fetch(baseUrl)).rejects.toThrow();
    });
});
