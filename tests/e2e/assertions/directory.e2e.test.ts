import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { cliSpec } from '../../setup/cli.specification.js';

describe('cli — directory snapshot', () => {
    test('matches an identical fixture tree', async () => {
        // Given — scaffold writes the exact tree committed under expected/cli-scaffold/
        const result = await cliSpec('scaffold match').project('cli-app').exec('scaffold').run();

        // Then — the snapshot matches
        expect(result.exitCode).toBe(0);
        await result.directory('out').toMatchFixture('cli-scaffold/out');
    });

    test('detects a changed file', async () => {
        // Given — scaffold-changed writes go.mod with different content
        const result = await cliSpec('scaffold changed')
            .project('cli-app')
            .exec('scaffold-changed')
            .run();

        // Then — diff surfaces the changed file
        await expect(result.directory('out').toMatchFixture('cli-scaffold/out')).rejects.toThrow(
            /Directory mismatch/,
        );
        await expect(result.directory('out').toMatchFixture('cli-scaffold/out')).rejects.toThrow(
            /go\.mod/,
        );
    });

    test('detects an extra file', async () => {
        // Given — scaffold-extra writes an unexpected file
        const result = await cliSpec('scaffold extra')
            .project('cli-app')
            .exec('scaffold-extra')
            .run();

        // Then — diff surfaces the added file
        await expect(result.directory('out').toMatchFixture('cli-scaffold/out')).rejects.toThrow(
            /UNEXPECTED\.txt/,
        );
    });

    test('detects a missing fixture', async () => {
        const result = await cliSpec('missing fixture').project('cli-app').exec('scaffold').run();

        await expect(result.directory('out').toMatchFixture('does-not-exist')).rejects.toThrow(
            /does not exist/,
        );
    });

    describe('update mode', () => {
        let tempFixtureDir: string;

        beforeEach(() => {
            tempFixtureDir = mkdtempSync(resolve(tmpdir(), 'snap-update-'));
        });

        afterEach(() => {
            rmSync(tempFixtureDir, { force: true, recursive: true });
        });

        test('update: true writes the fixture', async () => {
            // Given — fresh scaffold and a non-existent fixture name
            const fixtureName = `transient-fixture-${Date.now()}`;

            const result = await cliSpec('update write').project('cli-app').exec('scaffold').run();

            // When — update writes the fixture
            await result.directory('out').toMatchFixture(fixtureName, { update: true });

            // Then — running again without update mode now matches
            const result2 = await cliSpec('update verify')
                .project('cli-app')
                .exec('scaffold')
                .run();

            await result2.directory('out').toMatchFixture(fixtureName);

            // Cleanup committed transient fixture
            rmSync(resolve(import.meta.dirname, 'expected', fixtureName), {
                force: true,
                recursive: true,
            });
        });
    });

    describe('files() helper', () => {
        test('lists files recursively, sorted', async () => {
            const result = await cliSpec('files list').project('cli-app').exec('scaffold').run();

            const files = await result.directory('out').files();
            expect(files).toEqual(['docs/README.md', 'go.mod', 'main.go', 'src/index.txt']);
        });
    });
});
