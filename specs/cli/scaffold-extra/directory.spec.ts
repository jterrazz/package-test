import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

describe('directory', () => {
    test('detects an extra file', async () => {
        // Given - scaffold-extra writes an unexpected file
        const result = await cli
            .fixture(directory('../../shared/fixtures/cli-app/'))
            .exec('scaffold-extra');

        // Then - diff surfaces the added file (frozen: shared golden asserted negatively)
        await expect(
            expect(result.directory('out')).toMatch(
                directory('../../shared/expected/cli-scaffold/out/'),
                {
                    frozen: true,
                },
            ),
        ).rejects.toThrow(/UNEXPECTED\.txt/u);
    });
});
