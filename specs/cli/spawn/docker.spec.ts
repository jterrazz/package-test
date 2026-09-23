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
        'container log streams work as stream subjects',
        async () => {
            // Given - a spawned container that echoes a boot banner into its logs
            await using result = await dockerCli.exec('spawn shop');
            expect(result.exitCode).toBe(0);

            // Then - the container's stdout accessor supports the stream matchers
            const shop = result.container('shop');
            expect(shop.exists).toBeTruthy();
            expect(shop.stdout.text).toContain('booting-shop');
        },
        60_000,
    );
});
