import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

describe('tokens', () => {
    test('tokens match inside tree-snapshot file contents', async () => {
        // Given - a scaffold whose out/report.txt embeds a fresh uuid
        const result = await cli
            .fixture(directory('../../shared/fixtures/cli-app/'))
            .exec('scaffold-dynamic');

        // Then - the committed tree fixture matches via the {{uuid}} token
        expect(result.exitCode).toBe(0);
        await expect(result.directory('out')).toMatch(directory('./expected/dynamic-tree/'));
    });
});
