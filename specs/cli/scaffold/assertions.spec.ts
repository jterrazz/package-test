import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

const EXPECTED_DIR = resolve(import.meta.dirname, 'expected');

/*
 * This file is the framework's own matcher/accessor self-test: the toContain probes
 * demonstrate the .text/.raw/.file accessors and matcher behaviour themselves —
 * the fixture CLI's output is the vehicle, not the assertion target. Whole-output
 * correctness is exercised by the toMatch(file(…)) golden cases throughout.
 */

describe('assertions', () => {
    test('cwd points to the temp working directory', async () => {
        // Given - a scaffold run
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('scaffold');

        // Then - cwd is the isolated temp dir
        expect(result.filesystem.cwd).toMatch(/spec-command-/u);
    });

    test('files() lists the whole tree sorted, filtering defaults', async () => {
        // Given - a scaffold run
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('scaffold');

        // Then - cli.sh (spread via .fixture(directory('../../fixtures/cli-app/'))) and scaffold output both appear, sorted
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
            const a = await cli.fixture(directory('../../fixtures/cli-app/')).exec('scaffold');
            vi.stubEnv('TEST_UPDATE', '1');
            try {
                await expect(a.filesystem).toMatch(directory(`./expected/${fixtureName}/`));
            } finally {
                vi.unstubAllEnvs();
            }

            // Then - a second identical run matches
            const b = await cli.fixture(directory('../../fixtures/cli-app/')).exec('scaffold');
            await expect(b.filesystem).toMatch(directory(`./expected/${fixtureName}/`));
        } finally {
            rmSync(resolve(EXPECTED_DIR, fixtureName), { force: true, recursive: true });
        }
    });

    test('toMatch detects a diff', async () => {
        // Given - a fixture from scaffold, compared against scaffold-changed
        const fixtureName = `fs-diff-${Date.now()}`;
        try {
            const a = await cli.fixture(directory('../../fixtures/cli-app/')).exec('scaffold');
            vi.stubEnv('TEST_UPDATE', '1');
            try {
                await expect(a.filesystem).toMatch(directory(`./expected/${fixtureName}/`));
            } finally {
                vi.unstubAllEnvs();
            }

            // Then - the changed tree fails with a directory diff. Frozen: the fixture written above must not be overwritten with the changed tree under TEST_UPDATE
            // checker-disable-next-line c29 -- the changed tree is the second run the golden is compared against
            const b = await cli
                .fixture(directory('../../fixtures/cli-app/'))
                .exec('scaffold-changed');
            await expect(
                expect(b.filesystem).toMatch(directory(`./expected/${fixtureName}/`), {
                    frozen: true,
                }),
            ).rejects.toThrow(/Directory mismatch/u);
        } finally {
            rmSync(resolve(EXPECTED_DIR, fixtureName), { force: true, recursive: true });
        }
    });
});
