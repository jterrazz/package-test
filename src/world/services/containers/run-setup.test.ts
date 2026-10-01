import { describe, expect, test } from 'vitest';

import { RunSetupContainer } from './run-setup-container.adapter.js';
import setup, { DOCKER_ABSENT } from './run-setup.js';

async function absent(): Promise<void> {
    await Promise.resolve();
    throw new Error(DOCKER_ABSENT);
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
                await Promise.resolve();
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
        const afterLast = await asked();

        // Then - one address for both, still answering after the first, gone after the last
        expect(provided).toStrictEqual([url, url]);
        expect(afterFirst).toContain(DOCKER_ABSENT);
        expect(afterLast).toBe('fetch failed');
    });
});
