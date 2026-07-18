import { expect, test } from 'vitest';

import { cli as dockerCli } from '../../setup/docker.specification.js';

test('spawns a labelled container', async () => {
    // Given - a docker-aware runner
    const result = await dockerCli.exec('spawn worker');

    // Then - the container is tracked
    expect(result.exitCode).toBe(0);
});
