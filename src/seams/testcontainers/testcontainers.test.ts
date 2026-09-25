import { describe, expect, test } from 'vitest';

import { containerLabels, reuseEnabled, TestcontainersAdapter } from './testcontainers.js';

/*
 * The adapter IS the subject here, and it is not on the public entry — which
 * is what makes this a module test beside its module rather than a spec under
 * `specs/integration/`. What it answers with no container is proven here;
 * reading a live container's logs is proven where a run reads them, by the
 * api's initiation-errors specs, on the run's own container.
 */

describe('testcontainers adapter', () => {
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
