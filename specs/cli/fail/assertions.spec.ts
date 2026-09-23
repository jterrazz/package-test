import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

const EXPECTED_DIR = resolve(import.meta.dirname, 'expected');

/** Run a block with TEST_UPDATE=1 so toMatch writes the fixture. */
function inUpdateMode(block: () => void): void {
    vi.stubEnv('TEST_UPDATE', '1');
    try {
        block();
    } finally {
        vi.unstubAllEnvs();
    }
}

/*
 * This file is the framework's own matcher/accessor self-test: the toContain probes
 * demonstrate the .text/.raw/.file accessors and matcher behaviour themselves —
 * the fixture CLI's output is the vehicle, not the assertion target. Whole-output
 * correctness is exercised by the toMatch(file(…)) golden cases throughout.
 */

describe('assertions', () => {
    test('text exposes stderr content', async () => {
        // Given - a failing run
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('fail');

        // Then - stderr text is readable
        expect(result.stderr.text).toContain('Fatal: something went wrong');
    });

    test('toMatch round-trips', async () => {
        // Given - a stderr fixture created via update mode
        const fixtureName = `stderr-transient-${Date.now()}.txt`;
        try {
            const a = await cli.fixture(directory('../../fixtures/cli-app/')).exec('fail');
            inUpdateMode(() => {
                expect(a.stderr).toMatch(file(`./expected/${fixtureName}`));
            });

            // Then - a second identical run matches
            const b = await cli.fixture(directory('../../fixtures/cli-app/')).exec('fail');
            expect(b.stderr).toMatch(file(`./expected/${fixtureName}`));
        } finally {
            rmSync(resolve(EXPECTED_DIR, fixtureName), { force: true });
        }
    });
});
