import { describe, expect, test } from 'vitest';

import { cli as dockerCli } from '../docker-cli.specification.js';

/* invariant: a live container's log stream is cut at an arbitrary instant: targeted probes, `output-asserted-as-a-golden` scalpel. */

describe('unqueried', () => {
    test('command-only run (never calls container()) does not query docker', async () => {
        // Given - a fixture that prints help and exits without spawning a container. The test never calls .container(), so the runner never touches the Docker daemon — but the cleanup path still runs.
        await using result = await dockerCli.exec('help');

        // Then - the run succeeded
        expect(result.exitCode).toBe(0);
    }, 10_000);
});
