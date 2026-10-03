import { describe, expect, test } from 'vitest';

import { docker, cli as dockerCli } from '../docker-cli.specification.js';

describe('handle-docker', () => {
    test('reads a container the subject started, by its id', async () => {
        // Given - a container the subject spawned, known to the test by its id
        await using result = await dockerCli.exec('spawn shop');
        expect(result.exitCode).toBe(0);
        const id = result.container('shop').id ?? '';

        // Then - the handle's reader finds it, running
        const shop = docker(id);
        expect(shop.exists).toBe(true);
        expect(shop.running).toBe(true);
    }, 60_000);

    test('an id docker cannot inspect reads as absent, never as a throw', () => {
        // Given - an id no container carries
        const missing = docker('no-such-container');

        // Then - an accessor that is not there and not running, the question a test asks
        expect(missing.exists).toBe(false);
        expect(missing.running).toBe(false);
        expect(missing.status).toBe('absent');
    });
});
