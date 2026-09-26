import { existsSync, readdirSync, rmdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

const EXPECTED_DIR = resolve(import.meta.dirname, '_expected');

/** Git keeps no empty folder, so `_expected/` goes with its last golden. */
function removeGolden(path: string): void {
    rmSync(path, { force: true, recursive: true });
    if (existsSync(EXPECTED_DIR) && readdirSync(EXPECTED_DIR).length === 0) {
        rmdirSync(EXPECTED_DIR);
    }
}

function inUpdateMode(block: () => void): void {
    vi.stubEnv('TEST_UPDATE', '1');
    try {
        block();
    } finally {
        vi.unstubAllEnvs();
    }
}

/* The accessors and matchers are the subject here; the fixture CLI's output is the vehicle. */

describe('failure', () => {
    test('text exposes stderr content', async () => {
        // Given - a failing run
        const result = await cli.fixture(directory('../_fixtures/specimen-cli/')).exec('fail');

        // Then - stderr text is readable
        expect(result.stderr.text).toContain('Fatal: something went wrong');
    });

    test('toMatch round-trips', async () => {
        // Given - a stderr fixture created via update mode
        const fixtureName = `stderr-transient-${Date.now()}.txt`;
        try {
            const a = await cli.fixture(directory('../_fixtures/specimen-cli/')).exec('fail');
            inUpdateMode(() => {
                expect(a.stderr).toMatch(file(`./_expected/${fixtureName}`));
            });

            // Then - a second identical run matches
            const b = await cli.fixture(directory('../_fixtures/specimen-cli/')).exec('fail');
            expect(b.stderr).toMatch(file(`./_expected/${fixtureName}`));
        } finally {
            removeGolden(resolve(EXPECTED_DIR, fixtureName));
        }
    });
});
