import { once } from 'node:events';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { runToCompletion, ServedProcess } from './serve.js';

/** Binds the port the OS hands it and answers its own pid: no spec picks a port. */
const SERVER = `node -e "const s=require('node:http').createServer((q,r)=>r.end(String(process.pid)));s.listen(0,'127.0.0.1',()=>console.log('listening on port '+s.address().port))"`;
const READY = /listening on port (?<port>\d+)/u;

/** Never binds what it is handed: reports the port it got and stays up. */
const CALLS_HANDED = `node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/handed').catch(()=>{});setInterval(()=>{},1000)"`;
const PRINTS_HANDED = `node -e "console.log('handed '+process.env.PORT);setInterval(()=>{},1000)"`;

async function held(): Promise<{ paths: string[]; port: number; server: Server }> {
    const paths: string[] = [];
    const server = createServer((request, response) => {
        paths.push(request.url ?? '');
        response.end();
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (address === null || typeof address === 'string') {
        throw new Error('the held server has no port');
    }
    return { paths, port: address.port, server };
}

function alive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

let adapter: null | ServedProcess = null;

afterEach(async () => {
    await adapter?.stop();
    adapter = null;
});

describe('serve', () => {
    test('a served process — starts a server on the port it bound and reports its base url', async () => {
        // Given - a server that announces the port it got
        adapter = new ServedProcess({ command: SERVER, ready: READY }, process.cwd());

        // Then - the base url is that port, and it answers
        const baseUrl = await adapter.start();
        expect(baseUrl).toBe(`http://127.0.0.1:${adapter.port}`);
        const response = await fetch(baseUrl);
        expect(response.status).toBe(200);
    });

    test('a served process — fails fast with the captured output when the command dies', async () => {
        // Given - a command that exits immediately
        adapter = new ServedProcess(
            { command: `node -e "console.error('bad config'); process.exit(1)"`, timeout: 5000 },
            process.cwd(),
        );

        // Then - the error carries the child's own output
        await expect(adapter.start()).rejects.toThrow('bad config');
    });

    test('a served process — stop terminates the process group', async () => {
        // Given - a running server, and the pid it answers with
        adapter = new ServedProcess({ command: SERVER, ready: READY }, process.cwd());
        const baseUrl = await adapter.start();
        const answer = await fetch(baseUrl);
        const pid = Number(await answer.text());

        // When - it is stopped
        await adapter.stop();

        // Then - the server itself is gone, not only the shell that started it
        expect(alive(pid)).toBe(false);
    });

    test('a served process — the PORT form picks a port, hands it as PORT, and polls the ready path on it', async () => {
        // Given - a child that prints the port it is handed and answers nothing
        adapter = new ServedProcess(
            { command: PRINTS_HANDED, ready: '/health', timeout: 1500 },
            process.cwd(),
        );

        // Then - the path polled is on the port the child was handed
        const failure = await adapter.start().then(() => null, String);
        const polled = /did not answer on http:\/\/127\.0\.0\.1:(?<port>\d+)\/health /u.exec(
            failure ?? '',
        );
        const handed = /handed (?<port>\d+)/u.exec(failure ?? '');
        expect(polled?.groups?.port).toBeDefined();
        expect(handed?.groups?.port).toBe(polled?.groups?.port);
    });

    test('a served process — the PORT form hands a stated port as PORT and is ready once the path answers', async () => {
        // Given - a port this test holds and serves, stated to a child that calls it
        const { paths, port, server } = await held();
        adapter = new ServedProcess(
            { command: CALLS_HANDED, port, ready: '/health' },
            process.cwd(),
        );

        // Then - ready on that port, polled at the path, and the child was handed it
        try {
            await expect(adapter.start()).resolves.toBe(`http://127.0.0.1:${port}`);
            expect(paths).toContain('/health');
            await vi.waitFor(() => {
                expect(paths).toContain('/handed');
            });
        } finally {
            server.close();
        }
    });

    test('runToCompletion — a build step a service runs before it serves — the command sees the environment it is handed, and a failure throws naming it', () => {
        // Given - a step that succeeds only when it is handed the database it builds
        const step = `node -e "process.exit(process.env.DATABASE_URL === 'file:x.db' ? 0 : 3)"`;

        // Then - handed it, the step completes; handed nothing, it throws with the command
        expect(() => {
            runToCompletion(step, { ...process.env, DATABASE_URL: 'file:x.db' });
        }).not.toThrow();
        expect(() => {
            runToCompletion(step, { PATH: process.env.PATH });
        }).toThrow(/Command failed: node -e/u);
    });
});
