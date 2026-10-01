import { once } from 'node:events';
import { existsSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

    test('a served process — a command that dies before it is ready leaves nothing of its group running', async () => {
        // Given - a command that forks a sleeper into its group, then exits
        adapter = new ServedProcess(
            {
                command: `node -e "const c = require('node:child_process').spawn('sleep', ['30'], { stdio: 'ignore' }); console.log('sleeper ' + c.pid); process.exit(1)"`,
                timeout: 5000,
            },
            process.cwd(),
        );

        // Then - the refusal names the sleeper, and the sleeper is gone with the group
        const failure = await adapter.start().then(() => '', String);
        const sleeper = Number(/sleeper (?<pid>\d+)/u.exec(failure)?.groups?.pid);
        expect(sleeper).toBeGreaterThan(0);
        await expect.poll(() => alive(sleeper), { timeout: 3000 }).toBe(false);
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

    test('a served process — a server its shell left running is served, and stopped with SIGTERM before any SIGKILL', async () => {
        // Given - a shell that backgrounds a server recording the SIGTERM it receives, then exits
        const scratch = mkdtempSync(join(tmpdir(), 'serve-'));
        const marker = join(scratch, 'terminated');
        const server = `node -e "process.on('SIGTERM',()=>{require('node:fs').writeFileSync(process.argv[1],'');process.exit(0)});const s=require('node:http').createServer((q,r)=>r.end());s.listen(0,'127.0.0.1',()=>console.log('listening on port '+s.address().port))" ${marker} &`;
        adapter = new ServedProcess(
            { command: server, ready: READY, timeout: 5000 },
            process.cwd(),
        );

        // When - it is served, then stopped
        await adapter.start();
        await adapter.stop();

        // Then - the server was given its SIGTERM, and the chance to act on it
        expect(existsSync(marker)).toBe(true);
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
