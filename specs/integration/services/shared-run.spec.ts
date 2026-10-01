import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli as vitestCli } from '../../cli/vitest-cli.specification.js';

describe('shared-run', () => {
    test('two service-bearing projects of one run are served by the one run services', async () => {
        // Given - a scratch run of an integration() and a job() project, each worker recording the address it was provided
        const result = await vitestCli
            .fixture(directory('./_fixtures/shared-run/'))
            .exec('run --configLoader runner');
        expect(result.exitCode).toBe(0);
        const integrationUrl = result.file('integration.url').content;

        // Then - both projects' workers were handed the same address
        expect(integrationUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u);
        expect(result.file('job.url').content).toBe(integrationUrl);
    });
});
