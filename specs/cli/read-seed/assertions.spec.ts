import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

/*
 * This file is the framework's own matcher/accessor self-test: the toContain probes
 * demonstrate the .text/.raw/.file accessors and matcher behaviour themselves —
 * the fixture CLI's output is the vehicle, not the assertion target. Whole-output
 * correctness is exercised by the toMatch(file(…)) golden cases throughout.
 */

describe('assertions', () => {
    test('layers a shared project and a feature-local file tree into the cwd', async () => {
        // Given - the shared cli-app project spread first, then a feature-local tree (spwn.yaml + spwn/agents/…) laid out exactly as the cwd should look
        const result = await cli
            .fixture(directory('../../shared/fixtures/specimen-cli/'))
            .fixture(directory('./fixtures/spwn-seed/'))
            .exec('read-seed');

        // Then - the CLI saw both layers as one merged tree: the config file and the nested tree
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            worlds:
                - alpha
                - beta
            agents:
              spwn/agents/neo/journal/session-1.md
        `);
    });
});
