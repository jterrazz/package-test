import { describe, expect, test } from 'vitest';

import { cli as dockerCli } from '../setup/docker.specification.js';

describe('widget', () => {
    test('binds a docker runner result with await using', async () => {
        // Given - a docker-aware runner result bound with await using
        await using result = await dockerCli.exec('spawn thing');

        // Then - the container is disposed at scope exit (B5)
        expect(result.exitCode).toBe(0);
    });
});
