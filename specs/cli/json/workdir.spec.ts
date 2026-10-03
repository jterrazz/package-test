import { directory, file } from '@jterrazz/test';
import { existsSync, readdirSync, readFileSync, rmdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { cli } from '../cli.specification.js';

const EXPECTED_DIR = resolve(import.meta.dirname, '_expected');

/** Git keeps no empty folder, so `_expected/` goes with its last golden. */
function removeGolden(path: string): void {
    rmSync(path, { force: true, recursive: true });
    if (existsSync(EXPECTED_DIR) && readdirSync(EXPECTED_DIR).length === 0) {
        rmdirSync(EXPECTED_DIR);
    }
}

describe('workdir', () => {
    test('update mode substitutes the workdir inside JSON (rule `no-volatile-literal`, text/json parity)', async () => {
        // Given - a JSON payload whose values embed the run cwd, update mode on A fresh fixture name
        const fixtureName = `json-cwd-transient-${Date.now()}.json`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            const result = await cli
                .fixture(directory('../_fixtures/specimen-cli/'))
                .exec('json-cwd');
            const { value } = result.json;
            const rawCwd =
                typeof value === 'object' && value !== null && 'cwd' in value
                    ? String(value.cwd)
                    : '';
            vi.stubEnv('TEST_UPDATE', '1');
            try {
                expect(result.json).toMatch(file(`./_expected/${fixtureName}`));
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
                .fixture(directory('../_fixtures/specimen-cli/'))
                .exec('json-cwd');
            expect(second.json).toMatch(file(`./_expected/${fixtureName}`));
        } finally {
            removeGolden(fixturePath);
        }
    });
});
