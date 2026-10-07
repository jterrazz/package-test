import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/* invariant: the accessors and matchers are the subject here; the fixture CLI's output is the vehicle. */

describe('layered', () => {
    test('layers a shared project and a feature-local file tree into the cwd', async () => {
        // Given - the shared cli-app project spread first, then a feature-local tree (spwn.yaml + spwn/agents/…) laid out exactly as the cwd should look
        const result = await cli
            .fixture(directory('../__fixtures__/specimen-cli/'))
            .fixture(directory('./__fixtures__/spwn-seed/'))
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
