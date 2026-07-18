import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { text } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

/** Run an assertion expected to fail and return its thrown message. */
async function catchMessage(assertion: () => Promise<unknown>): Promise<string> {
    try {
        await assertion();
    } catch (error) {
        return (error as Error).message;
    }
    throw new Error('expected the assertion to throw, but it passed');
}

describe('command — directory snapshot', () => {
    test('matches an identical fixture tree', async () => {
        // Given - scaffold writes the exact tree committed under expected/cli-scaffold/
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('scaffold');

        // Then - the snapshot matches (a slash in the name creates a subfolder)
        expect(result.exitCode).toBe(0);
        await expect(result.directory('out')).toMatch('cli-scaffold/out');
    });

    test('detects a changed file', async () => {
        // Given - scaffold-changed writes go.mod with different content
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('scaffold-changed');

        // Then - diff surfaces the changed file. Frozen: the shared golden is asserted negatively
        // Here against a changed tree — TEST_UPDATE must not overwrite it with the changed output
        await expect(
            expect(result.directory('out')).toMatch('cli-scaffold/out', { frozen: true }),
        ).rejects.toThrow(/Directory mismatch/);
        await expect(
            expect(result.directory('out')).toMatch('cli-scaffold/out', { frozen: true }),
        ).rejects.toThrow(/go\.mod/);
    });

    test('detects an extra file', async () => {
        // Given - scaffold-extra writes an unexpected file
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('scaffold-extra');

        // Then - diff surfaces the added file (frozen: shared golden asserted negatively)
        await expect(
            expect(result.directory('out')).toMatch('cli-scaffold/out', { frozen: true }),
        ).rejects.toThrow(/UNEXPECTED\.txt/);
    });

    test('the directory mismatch diff is goldened in full (failure-message quality is the product)', async () => {
        // Given - scaffold-changed writes go.mod with different content than the fixture tree
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('scaffold-changed');

        // Then - the whole directory diff (counts + per-file line diff) is captured and goldened.
        // Frozen - the shared cli-scaffold/out golden is asserted negatively here; TEST_UPDATE must
        // Not overwrite it, and only the error golden updates
        const message = await catchMessage(() =>
            expect(result.directory('out')).toMatch('cli-scaffold/out', { frozen: true }),
        );
        expect(text(message)).toMatch('errors/directory-diff-error.txt');
    });

    test('detects a missing fixture', async () => {
        // Given - a fixture name that was never created
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('scaffold');

        // Then - clear error with the TEST_UPDATE hint. Frozen: under TEST_UPDATE the missing
        // Snapshot must still throw rather than be created
        await expect(
            // oxlint-disable-next-line jterrazz/c8-referenced-fixture-exists -- negative spec: the missing snapshot IS the behaviour under test
            expect(result.directory('out')).toMatch('does-not-exist', { frozen: true }),
        ).rejects.toThrow(/does not exist[\s\S]*TEST_UPDATE=1/);
    });

    describe('update mode', () => {
        test('writes the fixture under TEST_UPDATE=1', async () => {
            // Given - fresh scaffold and a non-existent fixture name
            const fixtureName = `transient-fixture-${Date.now()}`;

            const result = await cli.fixture('$FIXTURES/cli-app/').exec('scaffold');

            // When - update mode writes the fixture
            process.env.TEST_UPDATE = '1';
            try {
                await expect(result.directory('out')).toMatch(fixtureName);
            } finally {
                delete process.env.TEST_UPDATE;
            }

            // Then - running again without update mode now matches
            const result2 = await cli.fixture('$FIXTURES/cli-app/').exec('scaffold');
            await expect(result2.directory('out')).toMatch(fixtureName);

            // Cleanup committed transient fixture
            rmSync(resolve(import.meta.dirname, 'expected', fixtureName), {
                force: true,
                recursive: true,
            });
        });
    });

    describe('files() helper', () => {
        test('lists files recursively, sorted', async () => {
            // Given - a scaffold run
            const result = await cli.fixture('$FIXTURES/cli-app/').exec('scaffold');

            // Then - the tree listing is complete and sorted
            const files = await result.directory('out').files();
            expect(files).toEqual(['docs/README.md', 'go.mod', 'main.go', 'src/index.txt']);
        });
    });
});
