import { afterEach, describe, expect, test } from 'vitest';

import { ServeAdapter } from './serve.adapter.js';

/**
 * A server that binds the port the OS hands it, announces it, and answers with
 * its own pid — no spec picks a port, so none can be taken from under it.
 */
const SERVER = `node -e "const s=require('node:http').createServer((q,r)=>r.end(String(process.pid)));s.listen(0,'127.0.0.1',()=>console.log('listening on port '+s.address().port))"`;
const READY = /listening on port (?<port>\d+)/u;

/** Is a process with this pid still alive? */
function alive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

let adapter: null | ServeAdapter = null;

afterEach(async () => {
    await adapter?.stop();
    adapter = null;
});

describe('serve adapter', () => {
    test('starts a server on the port it bound and reports its base url', async () => {
        // Given - a server that announces the port it got
        adapter = new ServeAdapter({ command: SERVER, ready: READY }, process.cwd());

        // Then - the base url is that port, and it answers
        const baseUrl = await adapter.start();
        expect(baseUrl).toBe(`http://127.0.0.1:${adapter.port}`);
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
        // Given - a running server, and the pid it answers with
        adapter = new ServeAdapter({ command: SERVER, ready: READY }, process.cwd());
        const baseUrl = await adapter.start();
        const answer = await fetch(baseUrl);
        const pid = Number(await answer.text());

        // When - it is stopped
        await adapter.stop();

        // Then - the server itself is gone, not only the shell that started it
        expect(alive(pid)).toBe(false);
    });
});
