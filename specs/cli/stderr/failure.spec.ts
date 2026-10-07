import { directory, file } from '@jterrazz/test';
import { existsSync, readdirSync, rmdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { cli } from '../cli.specification.js';

const EXPECTED_DIR = resolve(import.meta.dirname, '__expected__');

/** Git keeps no empty folder, so `__expected__/` goes with its last golden. */
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

/* invariant: the accessors and matchers are the subject here; the fixture CLI's output is the vehicle. */

describe('failure', () => {
    test('text exposes stderr content', async () => {
        // Given - a failing run
        const result = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('fail');

        // Then - stderr text is readable
        expect(result.stderr.text).toContain('Fatal: something went wrong');
    });

    test('toMatch round-trips', async () => {
        // Given - a stderr fixture created via update mode
        const fixtureName = `stderr-transient-${Date.now()}.txt`;
        try {
            const a = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('fail');
            inUpdateMode(() => {
                expect(a.stderr).toMatch(file(`./__expected__/${fixtureName}`));
            });

            // Then - a second identical run matches
            const b = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('fail');
            expect(b.stderr).toMatch(file(`./__expected__/${fixtureName}`));
        } finally {
            removeGolden(resolve(EXPECTED_DIR, fixtureName));
        }
    });
});
