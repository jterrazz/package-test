import { execSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';

import {
    type CapturedContainer,
    DockerCliResult,
    findContainersByLabel,
} from '../../../src/index.js';
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

describe('cli — docker mode', () => {
    describe('DockerCliResult.container()', () => {
        test('returns an accessor with exists=false for missing containers', () => {
            const result = new DockerCliResult({
                commandResult: { exitCode: 0, stderr: '', stdout: '' },
                config: {},
                containers: new Map<string, CapturedContainer>(),
                nameLabel: 'fake.world.name',
                testDir: '/tmp',
                testRunId: 'abcd',
                testRunLabel: 'fake.test.run',
                workDir: '/tmp',
            });

            const missing = result.container('nope');
            expect(missing.exists).toBe(false);
            expect(missing.running).toBe(false);
        });

        test('returns an accessor with captured inspect state for known containers', () => {
            const containers = new Map<string, CapturedContainer>();
            containers.set('neo', {
                id: 'deadbeef',
                inspect: { State: { Running: true, Status: 'running' } },
            });
            const result = new DockerCliResult({
                commandResult: { exitCode: 0, stderr: '', stdout: '' },
                config: {},
                containers,
                nameLabel: 'fake.world.name',
                testDir: '/tmp',
                testRunId: 'abcd',
                testRunLabel: 'fake.test.run',
                workDir: '/tmp',
            });

            const neo = result.container('neo');
            expect(neo.exists).toBe(true);
            expect(neo.running).toBe(true);
            expect(neo.status).toBe('running');
            expect(result.containerIds).toEqual(['deadbeef']);
        });
    });

    describe.skipIf(!HAS_DOCKER)('end-to-end against real docker', () => {
        test('tracks labelled containers and cleans up on dispose', async () => {
            let trackedId: string | undefined;
            let runId: string | undefined;

            {
                await using result = await dockerCliSpec('spawn test-a').exec('spawn test-a').run();

                // The CLI should have exited cleanly.
                expect(result.exitCode).toBe(0);

                // Narrow to DockerCliResult so we can access container()/testRunId.
                expect(result).toBeInstanceOf(DockerCliResult);
                const docker = result as DockerCliResult;
                runId = docker.testRunId;

                // Test-a was spawned with our label — it should be discoverable.
                const neo = docker.container('test-a');
                expect(neo.exists).toBe(true);
                expect(neo.running).toBe(true);
                expect(neo.status).toBe('running');

                // A file written by the container's entrypoint can be read via exec.
                const file = neo.file('/workspace/out.txt');
                expect(file.exists).toBe(true);
                expect(file.content.trim()).toBe('hello-from-test-a');

                // Exec() inside the container returns the same CliResult shape.
                const inside = await neo.exec('ls /workspace');
                expect(inside.exitCode).toBe(0);
                inside.stdout.toContain('out.txt');

                // Absent container name → accessor with exists=false, no throw.
                expect(docker.container('nope').exists).toBe(false);

                // Track the ID so we can verify cleanup after the scope exits.
                trackedId = docker.containerIds[0];
                expect(trackedId).toBeTruthy();
            }

            // After `await using` dispose, the container should be gone.
            const remaining = findContainersByLabel('fake.test.run', runId!);
            expect(remaining).toHaveLength(0);
        }, 60_000);
    });
});
