import { directory, text } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

async function catchMessage(assertion: () => Promise<unknown>): Promise<string> {
    try {
        await assertion();
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
    throw new Error('expected the assertion to throw, but it passed');
}

describe('changed', () => {
    test('detects a changed file', async () => {
        // Given - scaffold-changed writes go.mod with different content
        const result = await cli
            .fixture(directory('../__fixtures__/specimen-cli/'))
            .exec('scaffold-changed');

        // Then - diff surfaces the changed file. Frozen: the shared golden is asserted negatively here against a changed tree; TEST_UPDATE must not overwrite it with the changed output
        await expect(
            expect(result.directory('out')).toMatch(directory('./__expected__/cli-scaffold/out/'), {
                frozen: true,
            }),
        ).rejects.toThrow(/Directory mismatch/u);
        await expect(
            expect(result.directory('out')).toMatch(directory('./__expected__/cli-scaffold/out/'), {
                frozen: true,
            }),
        ).rejects.toThrow(/go\.mod/u);
    });

    test('the directory mismatch diff is goldened in full (failure-message quality is the product)', async () => {
        // Given - scaffold-changed writes go.mod with different content than the fixture tree
        const result = await cli
            .fixture(directory('../__fixtures__/specimen-cli/'))
            .exec('scaffold-changed');

        // Then - the whole directory diff (counts + per-file line diff) is captured and goldened. frozen - the shared cli-scaffold/out golden is asserted negatively here; TEST_UPDATE must not overwrite it, and only the error golden updates
        const message = await catchMessage(async () => {
            await expect(result.directory('out')).toMatch(
                directory('./__expected__/cli-scaffold/out/'),
                {
                    frozen: true,
                },
            );
        });
        expect(text(message)).toMatch(`
            Directory mismatch: ./__expected__/cli-scaffold/out/
              1 difference: 0 added, 0 removed, 1 changed

            - Expected (fixture)
            + Received (generated)

            ~ changed  go.mod  (1 line differ)
                line 1:
                - module example
                + module CHANGED

            Run with TEST_UPDATE=1 to update the fixture.`);
    });
});
