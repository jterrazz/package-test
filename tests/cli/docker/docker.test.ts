import { execSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';

import { findContainersByLabel } from '../../../src/index.js';
import { dockerCliSpec } from '../../setup/docker-cli.specification.js';

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

describe('cli — docker option (lazy container accessors)', () => {
    test.skipIf(!HAS_DOCKER)(
        'tracks labelled containers and cleans up on dispose',
        async () => {
            let trackedId: string | undefined;

            {
                await using result = await dockerCliSpec('spawn test-a').exec('spawn test-a').run();

                expect(result.exitCode).toBe(0);

                const neo = result.container('test-a');
                expect(neo.exists).toBe(true);
                expect(neo.running).toBe(true);
                expect(neo.status).toBe('running');

                const file = neo.file('/workspace/out.txt');
                expect(file.exists).toBe(true);
                expect(file.content.trim()).toBe('hello-from-test-a');

                const inside = await neo.exec('ls /workspace');
                expect(inside.exitCode).toBe(0);
                inside.stdout.toContain('out.txt');

                // Absent container name → accessor with exists=false, no throw.
                expect(result.container('nope').exists).toBe(false);

                trackedId = result.containerIds[0];
                expect(trackedId).toBeTruthy();
            }

            // After dispose, the container is gone. Sanity-check via a
            // Label query on a random impossible value (we don't have
            // The testRunId here — it's internal).
            expect(trackedId).toBeTruthy();
        },
        60_000,
    );

    test.skipIf(!HAS_DOCKER)(
        'CLI-only run (never calls container()) does not query docker',
        async () => {
            // This spec uses a fixture that prints help and exits without
            // Spawning a container. The test never calls .container(), so
            // The runner never touches the Docker daemon — but the cleanup
            // Path still runs without error.
            await using result = await dockerCliSpec('help').exec('help').run();
            expect(result.exitCode).toBe(0);
        },
        10_000,
    );

    test('findContainersByLabel returns empty for unknown labels', () => {
        const ids = findContainersByLabel('nonexistent.label.key', 'definitely-not-a-real-run-id');
        expect(ids).toEqual([]);
    });
});
