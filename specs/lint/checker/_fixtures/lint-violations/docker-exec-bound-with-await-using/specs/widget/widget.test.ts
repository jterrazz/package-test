import { describe, expect, test } from 'vitest';

import { cli as dockerCli } from './docker.specification.js';

describe('widget', () => {
    test('binds a docker runner result without await using', async () => {
        // Given - a docker-aware runner result bound with a plain const
        const result = await dockerCli.exec('spawn thing');

        // Then - the container would leak (`docker-exec-bound-with-await-using`)
        expect(result.exitCode).toBe(0);
    });
});
