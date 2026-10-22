import { afterEach, describe, expect, onTestFinished, test } from 'vitest';

import { findFreePort } from '../listening.js';
import { DRAWN_PORTS } from '../port-reservation.js';
import { processService } from '../process.adapter.js';
import type { ProcessHandle } from '../process.adapter.js';
import { ANSWERS_ID } from './serve.fixtures.js';

// invariant: binds the port the OS hands it and announces it: no spec picks a port.
const SERVER = `node -e "const s=require('node:http').createServer((q,r)=>r.end(process.env.GREETING ?? 'ok'));s.listen(0,'127.0.0.1',()=>console.log('listening on port '+s.address().port))"`;
const READY = /listening on port (?<port>\d+)/u;

let started: null | ProcessHandle = null;

afterEach(async () => {
    await started?.shutdown();
    started = null;
});

async function shutdown(handles: ProcessHandle[]): Promise<void> {
    await Promise.all(
        handles.map(async (handle) => {
            await handle.shutdown();
        }),
    );
}

describe('process.adapter', () => {
    test('process — the one shape an external process takes — comes up on the port it bound, and answers', async () => {
        // Given - a process declared with its command and the line that announces its port
        started = processService({ command: SERVER, ready: READY });
        await started.spawnWith(process.cwd(), {}, 'run-1');

        // Then - it is reachable at the url the handle now carries
        const response = await fetch(started.url);
        await expect(response.text()).resolves.toBe('ok');
    });

    test('process — the one shape an external process takes — carries the environment it was declared with', async () => {
        // Given - a process handed one variable
        started = processService({ command: SERVER, env: { GREETING: 'bonjour' }, ready: READY });
        await started.spawnWith(process.cwd(), {}, 'run-2');

        // Then - the child read it
        const response = await fetch(started.url);
        await expect(response.text()).resolves.toBe('bonjour');
    });

    test('process — the one shape an external process takes — reads the environment off the services it was started beside', async () => {
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

    test('process — the one shape an external process takes — runs the one-shot command first, and refuses when it fails', async () => {
        // Given - a `before` that exits non-zero
        const handle = processService({
            before: `node -e "console.error('the build failed'); process.exit(2)"`,
            command: SERVER,
            ready: READY,
        });

        // Then - the specification stops there, naming itself, the exit and the output
        await expect(handle.spawnWith(process.cwd(), {}, 'run-4')).rejects.toThrow(
            /^found: specification\.process\(\): `before` exited 2\.\nCommand: node -e .*\nOutput:\nthe build failed\n/u,
        );
    });

    test('process — the one shape an external process takes — is an embedded service with no image, no database and no address until it runs, and stops even unstarted', async () => {
        // Given - a declared but unstarted process
        const handle = processService({ command: SERVER, ready: READY });

        // When - it is shut down before it ever ran, twice
        await handle.shutdown();
        await handle.shutdown();

        // Then - its declared shape
        expect({
            connectionString: handle.connectionString,
            database: handle.createDatabaseAdapter(),
            defaultImage: handle.defaultImage,
            defaultPort: handle.defaultPort,
            environment: handle.environment,
            serviceName: handle.serviceName,
            type: handle.type,
        }).toStrictEqual({
            connectionString: '',
            database: null,
            defaultImage: '',
            defaultPort: 0,
            environment: {},
            serviceName: null,
            type: 'process',
        });
    });

    test('process — the one shape an external process takes — refuses to name a url before it is up', () => {
        // Given - a declared but unstarted process
        const handle = processService({ command: SERVER, ready: READY });

        // Then - the refusal says where the url comes from
        expect(() => handle.url).toThrow(
            new Error(
                [
                    'found: process().url read before the process was ready',
                    "why: A process's URL is known once it is ready.",
                    'fix: read it from the started services record (`env: (services) => ...` or `server: (services) => ...`), never at declaration time',
                    'read: docs/reference/services.md#process-the-one-shape-an-external-process-takes',
                ].join('\n'),
            ),
        );
    });

    test('process — many started at once — are each handed a port of their own, below the range the OS hands unasked ports from, and each is ready on its own answer', async () => {
        // Given - processes started together, each slow to bind and answering an id of its own
        const handles = Array.from({ length: 16 }, (_, index) =>
            processService({
                command: ANSWERS_ID,
                env: { DELAY: '200', ID: String(index) },
                timeout: 10_000,
            }),
        );
        onTestFinished(async () => {
            await shutdown(handles);
        });

        // When - all of them start at once
        await Promise.all(
            handles.map(async (handle, index) => {
                await handle.spawnWith(process.cwd(), {}, `run-many-${String(index)}`);
            }),
        );

        // Then - no port was handed twice, none from the OS's range, and each url answers its own process
        const ports = handles.map((handle) => Number(new URL(handle.url).port));
        const answers = await Promise.all(
            handles.map(async (handle) => {
                const answer = await fetch(handle.url);
                return await answer.text();
            }),
        );
        expect([
            new Set(ports).size,
            ports.every((port) => port >= DRAWN_PORTS.first && port <= DRAWN_PORTS.last),
            answers,
        ]).toStrictEqual([16, true, handles.map((_, index) => String(index))]);
    }, 20_000);

    test('process — two pinning one port at once — the second is refused before its command runs, and the first serves', async () => {
        // Given - one free port, pinned by two processes slow to bind it
        const port = await findFreePort();
        const handles = [0, 1].map((index) =>
            processService({
                command: ANSWERS_ID,
                env: { DELAY: '300', ID: String(index) },
                port,
                timeout: 5000,
            }),
        );
        onTestFinished(async () => {
            await shutdown(handles);
        });

        // When - both start at once
        const outcomes = await Promise.allSettled(
            handles.map(async (handle) => {
                await handle.spawnWith(process.cwd(), {}, 'run-pinned');
            }),
        );

        // Then - one is ready on the port, the other refused naming it
        const refusals = outcomes.flatMap((outcome) =>
            outcome.status === 'rejected' ? [String(outcome.reason)] : [],
        );
        expect([
            outcomes.filter((outcome) => outcome.status === 'fulfilled').length,
            refusals,
        ]).toStrictEqual([
            1,
            [
                `Error: found: specification.process(): port ${String(port)}, which \`port\` pins, is reserved by another served process on this machine.\nCommand: ${ANSWERS_ID}\nOutput:\n\nwhy: A port is one served process's at a time, and a server sharing it would answer in the other's place.\nfix: drop the \`port\` option so each process is handed a free one, or run the specifications that pin it one at a time\nread: docs/reference/services.md#process-the-one-shape-an-external-process-takes`,
            ],
        ]);
    });
});
