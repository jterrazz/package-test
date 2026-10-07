import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('extra', () => {
    test('detects an extra file', async () => {
        // Given - scaffold-extra writes an unexpected file
        const result = await cli
            .fixture(directory('../__fixtures__/specimen-cli/'))
            .exec('scaffold-extra');

        // Then - diff surfaces the added file (frozen: shared golden asserted negatively)
        await expect(
            expect(result.directory('out')).toMatch(directory('./__expected__/cli-scaffold/out/'), {
                frozen: true,
            }),
        ).rejects.toThrow(/UNEXPECTED\.txt/u);
    });
});
