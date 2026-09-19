import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { TestcontainersAdapter } from '../../../src/integrations/testcontainers/testcontainers.js';

/*
 * Container-log probe (CONVENTIONS D11 scalpel): the subject is postgres's own startup
 * log stream — third-party output, unstable to snapshot across image versions. Probe
 * the one banner line that proves logs are captured.
 */

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
        // Given - a started postgres container
        const logs = await container.getLogs();

        // Then - its startup banner is readable
        expect(logs).toBeTruthy();
        expect(logs).toContain('database system is ready to accept connections');
    });

    test('returns empty string when container not started', async () => {
        // Given - an adapter that was never started
        const stopped = new TestcontainersAdapter({
            image: 'postgres:17',
            port: 5432,
        });

        // Then - log capture degrades to an empty string, no throw
        const logs = await stopped.getLogs();
        expect(logs).toBe('');
    });
});
