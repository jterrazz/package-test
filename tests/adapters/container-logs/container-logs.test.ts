import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { TestcontainersAdapter } from '../../../src/infra/containers/testcontainers.js';

describe('container logs', () => {
    let container: TestcontainersAdapter;

    beforeAll(async () => {
        container = new TestcontainersAdapter({
            image: 'postgres:17',
            port: 5432,
            env: { POSTGRES_DB: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_USER: 'test' },
        });
        await container.start();
    }, 30_000);

    afterAll(async () => {
        await container.stop();
    });

    test('captures logs from running container', async () => {
        const logs = await container.getLogs();

        expect(logs).toBeTruthy();
        expect(logs).toContain('database system is ready to accept connections');
    });

    test('returns empty string when container not started', async () => {
        const stopped = new TestcontainersAdapter({
            image: 'postgres:17',
            port: 5432,
        });

        const logs = await stopped.getLogs();
        expect(logs).toBe('');
    });
});
