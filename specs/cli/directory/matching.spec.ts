import { existsSync, readdirSync, rmdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

const EXPECTED_DIR = resolve(import.meta.dirname, 'expected');

/** Git keeps no empty folder, so `expected/` goes with its last golden. */
function removeGolden(path: string): void {
    rmSync(path, { force: true, recursive: true });
    if (existsSync(EXPECTED_DIR) && readdirSync(EXPECTED_DIR).length === 0) {
        rmdirSync(EXPECTED_DIR);
    }
}

describe('matching', () => {
    test('matches an identical fixture tree', async () => {
        // Given - scaffold writes the exact tree committed under expected/cli-scaffold/
        const result = await cli
            .fixture(directory('../../shared/fixtures/specimen-cli/'))
            .exec('scaffold');

        // Then - the snapshot matches (a slash in the name creates a subfolder)
        expect(result.exitCode).toBe(0);
        await expect(result.directory('out')).toMatch(directory('./expected/cli-scaffold/out/'));
    });

    test('detects a missing fixture', async () => {
        // Given - a fixture name that was never created
        const result = await cli
            .fixture(directory('../../shared/fixtures/specimen-cli/'))
            .exec('scaffold');

        // Then - clear error with the TEST_UPDATE hint. Frozen: under TEST_UPDATE the missing snapshot must still throw rather than be created
        await expect(
            // checker-disable-next-line c8 -- negative spec: the missing snapshot IS the behaviour under test
            expect(result.directory('out')).toMatch(directory('./expected/does-not-exist/'), {
                frozen: true,
            }),
        ).rejects.toThrow(/does not exist[\s\S]*TEST_UPDATE=1/u);
    });

    test('update mode — writes the fixture under TEST_UPDATE=1', async () => {
        // Given - fresh scaffold and a non-existent fixture name
        const fixtureName = `transient-fixture-${Date.now()}`;

        const result = await cli
            .fixture(directory('../../shared/fixtures/specimen-cli/'))
            .exec('scaffold');

        // When - update mode writes the fixture
        vi.stubEnv('TEST_UPDATE', '1');
        try {
            await expect(result.directory('out')).toMatch(directory(`./expected/${fixtureName}/`));
        } finally {
            vi.unstubAllEnvs();
        }

        // Then - running again without update mode now matches
        const result2 = await cli
            .fixture(directory('../../shared/fixtures/specimen-cli/'))
            .exec('scaffold');
        await expect(result2.directory('out')).toMatch(directory(`./expected/${fixtureName}/`));

        removeGolden(resolve(EXPECTED_DIR, fixtureName));
    });

    test('files() helper — lists files recursively, sorted', async () => {
        // Given - a scaffold run
        const result = await cli
            .fixture(directory('../../shared/fixtures/specimen-cli/'))
            .exec('scaffold');

        // Then - the tree listing is complete and sorted
        const files = await result.directory('out').files();
        expect(files).toStrictEqual(['docs/README.md', 'go.mod', 'main.go', 'src/index.txt']);
    });
});
