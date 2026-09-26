import { existsSync, readdirSync, rmdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

const EXPECTED_DIR = resolve(import.meta.dirname, '_expected');

/** Git keeps no empty folder, so `_expected/` goes with its last golden. */
function removeGolden(path: string): void {
    rmSync(path, { force: true, recursive: true });
    if (existsSync(EXPECTED_DIR) && readdirSync(EXPECTED_DIR).length === 0) {
        rmdirSync(EXPECTED_DIR);
    }
}

/* The accessors and matchers are the subject here; the fixture CLI's output is the vehicle. */

describe('tree', () => {
    test('cwd points to the temp working directory', async () => {
        // Given - a scaffold run
        const result = await cli
            .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
            .exec('scaffold');

        // Then - cwd is the isolated temp dir
        expect(result.filesystem.cwd).toMatch(/spec-command-/u);
    });

    test('files() lists the whole tree sorted, filtering defaults', async () => {
        // Given - a scaffold run
        const result = await cli
            .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
            .exec('scaffold');

        // Then - cli.sh (spread via .fixture(directory('../../_shared/_fixtures/specimen-cli/'))) and scaffold output both appear, sorted
        const files = await result.filesystem.files();
        expect(files).toContain('cli.sh');
        expect(files).toContain('out/main.go');
        expect(files).toContain('out/docs/README.md');
        expect([...files].sort()).toStrictEqual(files);
    });

    test('toMatch round-trips the entire working dir', async () => {
        // Given - a tree fixture created via update mode (flat under _expected/)
        const fixtureName = `fs-transient-${Date.now()}`;
        try {
            const a = await cli
                .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
                .exec('scaffold');
            vi.stubEnv('TEST_UPDATE', '1');
            try {
                await expect(a.filesystem).toMatch(directory(`./_expected/${fixtureName}/`));
            } finally {
                vi.unstubAllEnvs();
            }

            // Then - a second identical run matches
            const b = await cli
                .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
                .exec('scaffold');
            await expect(b.filesystem).toMatch(directory(`./_expected/${fixtureName}/`));
        } finally {
            removeGolden(resolve(EXPECTED_DIR, fixtureName));
        }
    });

    test('toMatch detects a diff', async () => {
        // Given - a fixture from scaffold, compared against scaffold-changed
        const fixtureName = `fs-diff-${Date.now()}`;
        try {
            const a = await cli
                .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
                .exec('scaffold');
            vi.stubEnv('TEST_UPDATE', '1');
            try {
                await expect(a.filesystem).toMatch(directory(`./_expected/${fixtureName}/`));
            } finally {
                vi.unstubAllEnvs();
            }

            // Then - the changed tree fails with a directory diff. Frozen: the fixture written above must not be overwritten with the changed tree under TEST_UPDATE
            const b = await cli
                .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
                .exec('scaffold-changed');
            await expect(
                expect(b.filesystem).toMatch(directory(`./_expected/${fixtureName}/`), {
                    frozen: true,
                }),
            ).rejects.toThrow(/Directory mismatch/u);
        } finally {
            removeGolden(resolve(EXPECTED_DIR, fixtureName));
        }
    });
});
