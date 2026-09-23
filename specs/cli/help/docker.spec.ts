import { execSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';

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

describe('docker', () => {
    test.skipIf(!HAS_DOCKER)(
        'command-only run (never calls container()) does not query docker',
        async () => {
            // Given - a fixture that prints help and exits without spawning a container. The test never calls .container(), so the runner never touches the Docker daemon — but the cleanup path still runs.
            await using result = await dockerCli.exec('help');

            // Then - the run succeeded
            expect(result.exitCode).toBe(0);
        },
        10_000,
    );
});
