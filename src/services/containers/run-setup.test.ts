import { connect } from 'node:net';
import { describe, expect, test } from 'vitest';

import { RunSetupContainer } from './run-setup-container.adapter.js';
import setup, { DOCKER_ABSENT } from './run-setup.js';

async function connection(url: string): Promise<string> {
    return await new Promise((resolve) => {
        const socket = connect(Number(new URL(url).port), '127.0.0.1');
        socket.on('connect', () => {
            socket.destroy();
            resolve('open');
        });
        socket.on('error', (error: NodeJS.ErrnoException) => {
            resolve(error.code ?? error.message);
        });
    });
}

async function absent(): Promise<void> {
    throw new Error(DOCKER_ABSENT);
}

async function refuses(): Promise<never> {
    throw new Error('the loopback refused to listen');
}

describe('setup', () => {
    test('the services setup — the run containers, served — provides a loopback address, and answers a request with one clear refusal when Docker is absent', async () => {
        // Given - the setup run with a runtime that no daemon answers
        const provided = new Map<string, unknown>();
        const teardown = await setup(
            {
                provide: (key: string, value: unknown) => {
                    provided.set(key, value);
                },
            },
            async () => {
                throw new Error(DOCKER_ABSENT);
            },
        );

        // When - a worker asks for a container
        const url = String(provided.get('serviceContainers'));
        const start = new RunSetupContainer(url, {
            image: 'postgres:17-alpine',
            port: 5432,
        }).start();

        // Then - the address is the loopback's, and the refusal names Docker
        try {
            expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u);
            await expect(start).rejects.toThrow(DOCKER_ABSENT);
        } finally {
            await teardown();
        }
    });

    test('the services setup — the run containers, served — is one per run: every project is provided the same address, served until the last project tears down', async () => {
        // Given - two projects' setups, as vitest runs one per project of a run
        const provided: string[] = [];
        const project = {
            provide: (_key: string, value: string) => {
                provided.push(value);
            },
        };
        const first = await setup(project, absent);
        const second = await setup(project, absent);
        const [url] = provided;
        const asked = async (): Promise<string> => {
            try {
                await new RunSetupContainer(String(url), {
                    image: 'redis:7-alpine',
                    port: 6379,
                }).start();
                return 'started';
            } catch (error) {
                return error instanceof Error ? error.message : String(error);
            }
        };

        // When - the first project tears down, then the last
        await first();
        const afterFirst = await asked();
        await second();

        // Then - one address for both, still answering after the first, gone after the last
        expect(provided).toStrictEqual([url, url]);
        expect(afterFirst).toContain(DOCKER_ABSENT);
        await expect(connection(String(url))).resolves.toBe('ECONNREFUSED');
    });

    test('the services setup — the run containers, served — never joins the registry another version of the package opened', async () => {
        // Given - a run whose registry was opened by another version of the package
        const foreign = Symbol.for('@jterrazz/test.run-services@0.0.0-foreign');
        const joined: string[] = [];
        Reflect.set(globalThis, foreign, {
            enter: async () => {
                joined.push('foreign');
                return { leave: async () => {}, url: 'http://foreign' };
            },
        });
        const provided: string[] = [];
        const teardown = await setup(
            {
                provide: (_key: string, value: string) => {
                    provided.push(value);
                },
            },
            absent,
        );

        // Then - this copy served its own, and the foreign registry was never entered
        try {
            expect(joined).toStrictEqual([]);
            expect(provided[0]).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u);
        } finally {
            await teardown();
            Reflect.deleteProperty(globalThis, foreign);
        }
    });

    test('the services setup — the run containers, served — a run whose services failed to open is opened afresh by the next setup', async () => {
        // Given - a first setup whose loopback server fails to open
        const provided: string[] = [];
        const project = {
            provide: (_key: string, value: string) => {
                provided.push(value);
            },
        };
        await expect(setup(project, absent, refuses)).rejects.toThrow(
            'the loopback refused to listen',
        );

        // When - a later project's setup runs
        const teardown = await setup(project, absent);

        // Then - it serves a fresh address rather than the first failure
        try {
            expect(provided).toHaveLength(1);
            await expect(connection(String(provided[0]))).resolves.toBe('open');
        } finally {
            await teardown();
        }
    });

    test('the services setup — the run containers, served — a teardown called twice leaves the services to the project still holding them', async () => {
        // Given - two projects holding the run's services
        const provided: string[] = [];
        const project = {
            provide: (_key: string, value: string) => {
                provided.push(value);
            },
        };
        const first = await setup(project, absent);
        const second = await setup(project, absent);
        const [url] = provided;

        // When - the first project's teardown runs twice
        await first();
        await first();

        // Then - the services still answer until the second project tears down
        await expect(connection(String(url))).resolves.toBe('open');
        await second();
        await expect(connection(String(url))).resolves.toBe('ECONNREFUSED');
    });
});
