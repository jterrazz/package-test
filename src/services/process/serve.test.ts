import { once } from 'node:events';
import { existsSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
    alive,
    CALLS_HANDED,
    held,
    PRINTS_HANDED,
    READY,
    REFUSALS,
    refused,
    SERVER,
    SILENT,
} from './serve.fixtures.js';
import { runToCompletion, ServedProcess } from './serve.js';

const SOURCE_FOLDER = join(process.cwd(), 'src');

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

    test.each(REFUSALS)('a served process — %s is refused whole', async (_, options, message) => {
        // Given - a process of that shape
        adapter = new ServedProcess(options, process.cwd(), 'api');

        // Then - the refusal in its four parts
        await expect(adapter.start()).rejects.toThrow(message);
    });

    test('a served process — runs in its folder, past a before step that passes, with the env, port and arguments it is handed', async () => {
        // Given - servers that report what they were handed on stderr, then exit, each with its own options
        const reports = `node -e "console.error(JSON.stringify([process.cwd(), process.env.SERVED_MODE, process.env.EXTRA, process.env.PORT, process.argv.length]))"`;
        const outputs: Record<string, string>[] = [];
        for (const [options, extra] of [
            [
                {
                    before: 'true',
                    command: reports,
                    cwd: 'src',
                    env: { SERVED_MODE: 'set' },
                    ready: /never (?<port>\d+)/u,
                },
                { EXTRA: 'added' },
            ],
            [
                {
                    command: reports,
                    env: () => ({ SERVED_MODE: 'later' }),
                    ready: /never (?<port>\d+)/u,
                },
                {},
            ],
        ] as const) {
            adapter = new ServedProcess(options, process.cwd(), undefined, extra);
            const failure = await adapter.start().then(() => '', String);
            outputs.push({
                .../found: (?<facet>specification\.\w+\(\)):[\s\S]*Output:\n(?<output>.*)\n/mu.exec(
                    failure,
                )?.groups,
            });
        }

        // Then - each child saw what its options state, on the default facet's refusal
        expect(outputs).toStrictEqual([
            {
                facet: 'specification.website()',
                output: JSON.stringify([SOURCE_FOLDER, 'set', 'added', null, 1]),
            },
            {
                facet: 'specification.website()',
                output: JSON.stringify([process.cwd(), null, null, null, 1]),
            },
        ]);
    });

    test('a served process — a command that cannot start in its folder is refused as one that exited, and leaves this process alive', async () => {
        // Given - a folder that is not there
        adapter = new ServedProcess(
            { command: 'true', cwd: 'no-such-folder', ready: READY, timeout: 5000 },
            process.cwd(),
            'api',
        );

        // Then - the refusal names the failed spawn
        await expect(adapter.start()).rejects.toThrow(
            refused(
                'the server command exited before it was ready.\nCommand: true\nOutput:\nError: spawn /bin/sh ENOENT\n',
                'A process is handed to the chain once it is ready, and one that exits never is.',
                'run the command by hand and correct what its output names',
            ),
        );
    });

    test('a served process — a redirect is an answer, never followed', async () => {
        // Given - a port that answers with a redirect to nowhere
        const server = createServer((_, response) => {
            response.writeHead(302, { location: 'http://127.0.0.1:9/' }).end();
        });
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const address = server.address();
        const port = address === null || typeof address === 'string' ? 0 : address.port;
        adapter = new ServedProcess({ command: SILENT, port, timeout: 2000 }, process.cwd());

        // Then - ready on the redirect itself
        try {
            await expect(adapter.start()).resolves.toBe(`http://127.0.0.1:${port}`);
        } finally {
            server.close();
        }
    });

    test('a served process — the PORT form with no ready path polls the root', async () => {
        // Given - a port this test holds, and no ready path stated
        const { paths, port, server } = await held();
        adapter = new ServedProcess({ command: SILENT, port }, process.cwd());

        // Then - ready once the root answers
        try {
            await expect(adapter.start()).resolves.toBe(`http://127.0.0.1:${port}`);
            expect(paths).toStrictEqual(['/']);
        } finally {
            server.close();
        }
    });

    test('a served process — stop ends a server deaf to SIGTERM, and a group its shell left deaf to it, with SIGKILL after the grace', async () => {
        // Given - a server that ignores SIGTERM, and a shell that backgrounds one and exits
        const deaf = `node -e "process.on('SIGTERM',()=>{});const s=require('node:http').createServer((q,r)=>r.end(String(process.pid)));s.listen(0,'127.0.0.1',()=>console.log('listening on port '+s.address().port))"`;
        const pids: number[] = [];
        for (const command of [deaf, `${deaf} &`]) {
            adapter = new ServedProcess({ command, ready: READY, timeout: 5000 }, process.cwd());
            const answer = await fetch(await adapter.start());
            pids.push(Number(await answer.text()));

            // When - it is stopped
            await adapter.stop();
        }

        // Then - neither server outlived the stop, once the system reaped it
        await expect
            .poll(() => pids.map((pid) => alive(pid)), { timeout: 3000 })
            .toStrictEqual([false, false]);
    }, 15_000);

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
