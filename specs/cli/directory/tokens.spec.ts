import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('tokens', () => {
    test('tokens match inside tree-snapshot file contents', async () => {
        // Given - a scaffold whose out/report.txt embeds a fresh uuid
        const result = await cli
            .fixture(directory('../_fixtures/specimen-cli/'))
            .exec('scaffold-dynamic');

        // Then - the committed tree fixture matches via the {{uuid}} token
        expect(result.exitCode).toBe(0);
        await expect(result.directory('out')).toMatch(directory('./_expected/dynamic-tree/'));
    });
});
