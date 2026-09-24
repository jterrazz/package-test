import { execSync } from 'node:child_process';
import { afterAll, describe, expect, test } from 'vitest';

import { containerLabels, reuseEnabled, TestcontainersAdapter } from './testcontainers.js';

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

/**
 * What a container start may take: testcontainers' own wait strategy gives
 * the readiness line 60 s, and creating the container comes before it.
 */
const CONTAINER_BUDGET_MS = 120_000;

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
    }, CONTAINER_BUDGET_MS);

    test.skipIf(!HAS_DOCKER)(
        'captures the logs of a running container',
        async () => {
            // Given - a started postgres container
            await started.start();

            // Then - its startup banner is readable
            const logs = await started.getLogs();
            expect(logs).toContain('database system is ready to accept connections');
        },
        CONTAINER_BUDGET_MS,
    );

    test('degrades to an empty string when the container was never started', async () => {
        // Given - an adapter nothing ever started
        const never = new TestcontainersAdapter({ image: 'postgres:17', port: 5432 });

        // Then - log capture answers empty rather than throwing
        await expect(never.getLogs()).resolves.toBe('');
    });
});

describe('container reuse', () => {
    test('is asked for by TESTCONTAINERS_REUSE_ENABLE=true, and never on CI', () => {
        // Given - the environments a run starts in
        const decided = {
            asked: reuseEnabled({ TESTCONTAINERS_REUSE_ENABLE: 'true' }),
            askedOnCi: reuseEnabled({ CI: 'true', TESTCONTAINERS_REUSE_ENABLE: 'true' }),
            askedWithCiOff: reuseEnabled({ CI: 'false', TESTCONTAINERS_REUSE_ENABLE: 'true' }),
            declined: reuseEnabled({ TESTCONTAINERS_REUSE_ENABLE: 'false' }),
            unasked: reuseEnabled({}),
        };

        // Then - only a local run that asked reuses
        expect(decided).toStrictEqual({
            asked: true,
            askedOnCi: false,
            askedWithCiOff: true,
            declined: false,
            unasked: false,
        });
    });

    test('labels every container, and a reused one as outliving the run', () => {
        // Given - the labels of a container of the run, and of a reused one
        // Then - both carry the package's label, and only the reused one says so
        expect({ reused: containerLabels(true), run: containerLabels(false) }).toStrictEqual({
            reused: { 'com.jterrazz.test': 'true', 'com.jterrazz.test.reuse': 'true' },
            run: { 'com.jterrazz.test': 'true' },
        });
    });
});
