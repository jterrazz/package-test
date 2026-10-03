import { describe, expect, test } from 'vitest';

import { cli as dockerCli } from '../docker-cli.specification.js';

/* invariant: a live container's log stream is cut at an arbitrary instant: targeted probes, `output-asserted-as-a-golden` scalpel. */

describe('spawn', () => {
    test('container log streams work as stream subjects', async () => {
        // Given - a spawned container that echoes a boot banner into its logs
        await using result = await dockerCli.exec('spawn shop');
        expect(result.exitCode).toBe(0);

        // Then - the container's stdout accessor supports the stream matchers
        const shop = result.container('shop');
        expect(shop.exists).toBe(true);
        expect(shop.stdout.text).toContain('booting-shop');
    }, 60_000);
});
