import { execSync } from 'node:child_process';
import { afterAll, describe, expect, test } from 'vitest';

import { TestcontainersAdapter } from './testcontainers.js';

function dockerAvailable(): boolean {
    try {
        execSync('docker version --format "{{.Server.Version}}"', {
            stdio: 'ignore',
            timeout: 3000,
        });
        return true;
    } catch {
        return false;
    }
}

const HAS_DOCKER = dockerAvailable();

/*
 * The adapter IS the subject here, and it is not on the public entry — which
 * is what makes this a module test beside its module rather than a spec under
 * `specs/integration/`. Log capture needs a live container, so that half
 * self-skips without Docker, exactly like the docker-aware cli probes.
 *
 * CONVENTIONS D11 scalpel (c): the stream is postgres's own startup log,
 * third-party output unstable to snapshot across image versions — probe the
 * one banner line that proves capture works.
 */

describe('testcontainers adapter', () => {
    const started = new TestcontainersAdapter({
        env: { POSTGRES_DB: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_USER: 'test' },
        image: 'postgres:17',
        port: 5432,
    });

    afterAll(async () => {
        await started.stop();
    });

    test.skipIf(!HAS_DOCKER)(
        'captures the logs of a running container',
        async () => {
            // Given - a started postgres container
            await started.start();

            // Then - its startup banner is readable
            const logs = await started.getLogs();
            expect(logs).toContain('database system is ready to accept connections');
        },
        30_000,
    );

    test('degrades to an empty string when the container was never started', async () => {
        // Given - an adapter nothing ever started
        const never = new TestcontainersAdapter({ image: 'postgres:17', port: 5432 });

        // Then - log capture answers empty rather than throwing
        await expect(never.getLogs()).resolves.toBe('');
    });
});
