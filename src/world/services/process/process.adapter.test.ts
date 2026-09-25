import { afterEach, describe, expect, test } from 'vitest';

import { processService } from './process.adapter.js';
import type { ProcessHandle } from './process.adapter.js';

/** A server that binds the port the OS hands it and announces it — no spec picks a port. */
const SERVER = `node -e "const s=require('node:http').createServer((q,r)=>r.end(process.env.GREETING ?? 'ok'));s.listen(0,'127.0.0.1',()=>console.log('listening on port '+s.address().port))"`;
const READY = /listening on port (?<port>\d+)/u;

let started: null | ProcessHandle = null;

afterEach(async () => {
    await started?.shutdown();
    started = null;
});

describe('process — the one shape an external process takes', () => {
    test('comes up on the port it bound, and answers', async () => {
        // Given - a process declared with its command and the line that announces its port
        started = processService({ command: SERVER, ready: READY });
        await started.spawnWith(process.cwd(), {}, 'run-1');

        // Then - it is reachable at the url the handle now carries
        const response = await fetch(started.url);
        await expect(response.text()).resolves.toBe('ok');
    });

    test('carries the environment it was declared with', async () => {
        // Given - a process handed one variable
        started = processService({ command: SERVER, env: { GREETING: 'bonjour' }, ready: READY });
        await started.spawnWith(process.cwd(), {}, 'run-2');

        // Then - the child read it
        const response = await fetch(started.url);
        await expect(response.text()).resolves.toBe('bonjour');
    });

    test('reads the environment off the services it was started beside', async () => {
        // Given - a process whose env is a function of a sibling's connection
        const siblings = { db: { connectionString: 'postgres://db.test:5432/app' } };
        started = processService({
            command: SERVER,
            env: (services) => ({ GREETING: services.db?.connectionString ?? 'unset' }),
            ready: READY,
        });
        await started.spawnWith(process.cwd(), siblings, 'run-3');

        // Then - the child was handed the sibling's string, not a placeholder
        const response = await fetch(started.url);
        await expect(response.text()).resolves.toBe('postgres://db.test:5432/app');
    });

    test('runs the one-shot command first, and refuses when it fails', async () => {
        // Given - a `before` that exits non-zero
        const handle = processService({
            before: `node -e "console.error('the build failed'); process.exit(2)"`,
            command: SERVER,
            ready: READY,
        });

        // Then - the specification stops there, naming the exit and the output
        await expect(handle.spawnWith(process.cwd(), {}, 'run-4')).rejects.toThrow(
            'the build failed',
        );
    });

    test('refuses to name a url before it is up', () => {
        // Given - a declared but unstarted process
        const handle = processService({ command: SERVER, ready: READY });

        // Then - the refusal says where the url comes from
        expect(() => handle.url).toThrow('known once the process is ready');
    });
});
