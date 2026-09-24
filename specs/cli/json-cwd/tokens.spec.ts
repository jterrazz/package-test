import { existsSync, readdirSync, readFileSync, rmdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

const EXPECTED_DIR = resolve(import.meta.dirname, 'expected');

/** Remove a golden a test wrote, and `expected/` once it holds nothing — git keeps no empty folder. */
function removeGolden(path: string): void {
    rmSync(path, { force: true, recursive: true });
    if (existsSync(EXPECTED_DIR) && readdirSync(EXPECTED_DIR).length === 0) {
        rmdirSync(EXPECTED_DIR);
    }
}

describe('tokens', () => {
    test('update mode substitutes the workdir inside JSON (CONVENTIONS D5, text/json parity)', async () => {
        // Given - a JSON payload whose values embed the run cwd, update mode on A fresh fixture name
        const fixtureName = `json-cwd-transient-${Date.now()}.json`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            const result = await cli
                .fixture(directory('../../shared/fixtures/specimen-cli/'))
                .exec('json-cwd');
            const rawCwd = (result.json.value as { cwd: string }).cwd;
            vi.stubEnv('TEST_UPDATE', '1');
            try {
                expect(result.json).toMatch(file(`./expected/${fixtureName}`));
            } finally {
                vi.unstubAllEnvs();
            }

            // Then - the written JSON holds the {{workdir}} token, never the raw path
            const written = readFileSync(fixturePath, 'utf8');
            expect(written).toContain('"{{workdir}}"');
            expect(written).toContain('wrote {{workdir}}/out.txt');
            expect(written).not.toContain(rawCwd);

            // Then - a second run (different cwd) matches the updated fixture
            const second = await cli
                .fixture(directory('../../shared/fixtures/specimen-cli/'))
                .exec('json-cwd');
            expect(second.json).toMatch(file(`./expected/${fixtureName}`));
        } finally {
            removeGolden(fixturePath);
        }
    });
});
