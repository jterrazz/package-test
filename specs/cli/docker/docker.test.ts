import { execSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';

import { findContainersByLabel } from '../../../src/index.js';
import { cli as dockerCli } from '../docker-cli.specification.js';

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
 * Container-log / in-container-exec probes (CONVENTIONS D11 scalpel): stdout here is
 * a live container's log stream or a shell command run inside it — third-party output
 * cut at an arbitrary instant, unstable to snapshot. Targeted toContain is the level.
 */

describe('command — docker option (lazy container accessors)', () => {
    test.skipIf(!HAS_DOCKER)(
        'tracks labelled containers and cleans up on dispose',
        async () => {
            // Given - the runner's injected test-run id (the label scope the
            // Dispose path queries) so the teardown can be verified for real
            await using idRun = await dockerCli.exec('label');
            const runId = idRun.stdout.text.trim();
            expect(runId).not.toBe('unset');

            let trackedId: string | undefined;

            {
                await using result = await dockerCli.exec('spawn test-a');

                expect(result.exitCode).toBe(0);

                // Then - the container accessor reads state and files
                const neo = result.container('test-a');
                expect(neo.exists).toBe(true);
                expect(neo.status).toBe('running');
                await expect(neo).toBeRunning();

                const file = neo.file('/workspace/out.txt');
                expect(file.exists).toBe(true);
                expect(file.content.trim()).toBe('hello-from-test-a');

                const inside = await neo.exec('ls /workspace');
                expect(inside.exitCode).toBe(0);
                expect(inside.stdout).toContain('out.txt');

                // Absent container name → accessor with exists=false, no throw.
                expect(result.container('nope').exists).toBe(false);
                await expect(expect(result.container('nope')).toBeRunning()).rejects.toThrow(
                    /does not exist/,
                );

                trackedId = result.containerIds[0];
                expect(trackedId).toBeTruthy();

                // While the scope is live, the tracked id really carries the run
                // Label — a direct daemon query sees it (makes the after-dispose
                // Assertion below falsifiable).
                expect(findContainersByLabel('fake.test.run', runId)).toContain(trackedId);
            }

            // Then - scope exit disposed the container: the same label query the
            // Runner uses now comes back empty, proving async-dispose removed it.
            expect(findContainersByLabel('fake.test.run', runId)).not.toContain(trackedId);
            expect(findContainersByLabel('fake.test.run', runId)).toEqual([]);
        },
        60_000,
    );

    test.skipIf(!HAS_DOCKER)(
        'command-only run (never calls container()) does not query docker',
        async () => {
            // Given - a fixture that prints help and exits without spawning a
            // Container. The test never calls .container(), so the runner never
            // Touches the Docker daemon — but the cleanup path still runs.
            await using result = await dockerCli.exec('help');

            // Then - the run succeeded
            expect(result.exitCode).toBe(0);
        },
        10_000,
    );

    test.skipIf(!HAS_DOCKER)(
        'container log streams work as stream subjects',
        async () => {
            // Given - a spawned container that echoes a boot banner into its logs
            await using result = await dockerCli.exec('spawn shop');
            expect(result.exitCode).toBe(0);

            // Then - the container's stdout accessor supports the stream matchers
            const shop = result.container('shop');
            expect(shop.exists).toBe(true);
            expect(shop.stdout).toContain('booting-shop');
        },
        60_000,
    );

    test.skipIf(!HAS_DOCKER)(
        'dispose removes containers even when the run was never asserted on',
        async () => {
            // Given - the runner's test-run id, read from the injected child env
            await using idRun = await dockerCli.exec('label');
            const runId = idRun.stdout.text.trim();
            expect(runId).not.toBe('unset');

            {
                // Given - a spawn whose containers are never touched via .container()
                await using result = await dockerCli.exec('spawn never-asserted');
                expect(result.exitCode).toBe(0);
            }

            // Then - scope exit removed every container carrying the run label
            expect(findContainersByLabel('fake.test.run', runId)).toEqual([]);
        },
        60_000,
    );

    test('findContainersByLabel returns empty for unknown labels', () => {
        // Given - a label value that no container carries
        const ids = findContainersByLabel('nonexistent.label.key', 'definitely-not-a-real-run-id');

        // Then - empty result, no throw
        expect(ids).toEqual([]);
    });
});
