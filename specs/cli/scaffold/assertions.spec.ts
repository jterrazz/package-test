import { existsSync, readdirSync, rmdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

const EXPECTED_DIR = resolve(import.meta.dirname, 'expected');

/** Remove a golden a test wrote, and `expected/` once it holds nothing — git keeps no empty folder. */
function removeGolden(path: string): void {
    rmSync(path, { force: true, recursive: true });
    if (existsSync(EXPECTED_DIR) && readdirSync(EXPECTED_DIR).length === 0) {
        rmdirSync(EXPECTED_DIR);
    }
}

/*
 * This file is the framework's own matcher/accessor self-test: the toContain probes
 * demonstrate the .text/.raw/.file accessors and matcher behaviour themselves —
 * the fixture CLI's output is the vehicle, not the assertion target. Whole-output
 * correctness is exercised by the toMatch(file(…)) golden cases throughout.
 */

describe('assertions', () => {
    test('cwd points to the temp working directory', async () => {
        // Given - a scaffold run
        const result = await cli
            .fixture(directory('../../shared/fixtures/cli-app/'))
            .exec('scaffold');

        // Then - cwd is the isolated temp dir
        expect(result.filesystem.cwd).toMatch(/spec-command-/u);
    });

    test('files() lists the whole tree sorted, filtering defaults', async () => {
        // Given - a scaffold run
        const result = await cli
            .fixture(directory('../../shared/fixtures/cli-app/'))
            .exec('scaffold');

        // Then - cli.sh (spread via .fixture(directory('../../shared/fixtures/cli-app/'))) and scaffold output both appear, sorted
        const files = await result.filesystem.files();
        expect(files).toContain('cli.sh');
        expect(files).toContain('out/main.go');
        expect(files).toContain('out/docs/README.md');
        expect([...files].sort()).toStrictEqual(files);
    });

    test('toMatch round-trips the entire working dir', async () => {
        // Given - a tree fixture created via update mode (flat under expected/)
        const fixtureName = `fs-transient-${Date.now()}`;
        try {
            const a = await cli
                .fixture(directory('../../shared/fixtures/cli-app/'))
                .exec('scaffold');
            vi.stubEnv('TEST_UPDATE', '1');
            try {
                await expect(a.filesystem).toMatch(directory(`./expected/${fixtureName}/`));
            } finally {
                vi.unstubAllEnvs();
            }

            // Then - a second identical run matches
            const b = await cli
                .fixture(directory('../../shared/fixtures/cli-app/'))
                .exec('scaffold');
            await expect(b.filesystem).toMatch(directory(`./expected/${fixtureName}/`));
        } finally {
            removeGolden(resolve(EXPECTED_DIR, fixtureName));
        }
    });

    test('toMatch detects a diff', async () => {
        // Given - a fixture from scaffold, compared against scaffold-changed
        const fixtureName = `fs-diff-${Date.now()}`;
        try {
            const a = await cli
                .fixture(directory('../../shared/fixtures/cli-app/'))
                .exec('scaffold');
            vi.stubEnv('TEST_UPDATE', '1');
            try {
                await expect(a.filesystem).toMatch(directory(`./expected/${fixtureName}/`));
            } finally {
                vi.unstubAllEnvs();
            }

            // Then - the changed tree fails with a directory diff. Frozen: the fixture written above must not be overwritten with the changed tree under TEST_UPDATE
            // checker-disable-next-line c29 -- the changed tree is the second run the golden is compared against
            const b = await cli
                .fixture(directory('../../shared/fixtures/cli-app/'))
                .exec('scaffold-changed');
            await expect(
                expect(b.filesystem).toMatch(directory(`./expected/${fixtureName}/`), {
                    frozen: true,
                }),
            ).rejects.toThrow(/Directory mismatch/u);
        } finally {
            removeGolden(resolve(EXPECTED_DIR, fixtureName));
        }
    });
});
