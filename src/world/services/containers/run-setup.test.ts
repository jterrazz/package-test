import { describe, expect, test } from 'vitest';

import { RunSetupContainer } from './run-setup-container.adapter.js';
import setup, { DOCKER_ABSENT } from './run-setup.js';

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
});
