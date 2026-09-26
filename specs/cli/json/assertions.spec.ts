import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
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

describe('assertions', () => {
    test('toMatch writes with TEST_UPDATE then passes on identical content', async () => {
        // Given - a fixture created via update mode
        const fixtureName = `stdout-transient-${Date.now()}.txt`;
        try {
            const a = await cli
                .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
                .exec('json');
            inUpdateMode(() => {
                expect(a.stdout).toMatch(file(`./_expected/${fixtureName}`));
            });

            // Then - a second identical run matches _expected/<name> (flat)
            const b = await cli
                .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
                .exec('json');
            expect(b.stdout).toMatch(file(`./_expected/${fixtureName}`));
        } finally {
            removeGolden(resolve(EXPECTED_DIR, fixtureName));
        }
    });

    test('toMatch fails with a diff on mismatch', async () => {
        // Given - a fixture that differs from the actual output
        const fixtureName = `stdout-mismatch-${Date.now()}.txt`;
        try {
            mkdirSync(EXPECTED_DIR, { recursive: true });
            writeFileSync(resolve(EXPECTED_DIR, fixtureName), 'different\n');

            // Then - the matcher reports an output diff (frozen: assert the diff even under TEST_UPDATE)
            const result = await cli
                .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
                .exec('json');
            expect(() => {
                expect(result.stdout).toMatch(file(`./_expected/${fixtureName}`), { frozen: true });
            }).toThrow(/Output mismatch/u);
        } finally {
            removeGolden(resolve(EXPECTED_DIR, fixtureName));
        }
    });

    test('a frozen fixture is never rewritten under TEST_UPDATE (negative-fixture guard)', async () => {
        // Given - a deliberately-wrong fixture whose diff is the behaviour under test
        const fixtureName = `frozen-wrong-${Date.now()}.txt`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            mkdirSync(EXPECTED_DIR, { recursive: true });
            writeFileSync(fixturePath, 'deliberately wrong\n');
            const result = await cli
                .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
                .exec('json');

            // Then - even in update mode, a frozen mismatch still throws its diff and never writes
            inUpdateMode(() => {
                expect(() => {
                    expect(result.stdout).toMatch(file(`./_expected/${fixtureName}`), {
                        frozen: true,
                    });
                }).toThrow(/Output mismatch/u);
            });
            expect(readFileSync(fixturePath, 'utf8')).toBe('deliberately wrong\n');
        } finally {
            removeGolden(fixturePath);
        }
    });

    test('toMatch requires the extension in the name', async () => {
        // Given - a fixture name without extension
        const result = await cli
            .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
            .exec('json');

        // Then - the matcher enforces rule `golden-path-has-extension` frozen - a negative assertion; keep it update-safe alongside the rest of the sweep
        expect(() => {
            // checker-disable-next-line named-path-exists -- negative spec: the golden with no extension exists nowhere, and that IS the behaviour under test
            // oxlint-disable-next-line jterrazz/golden-path-has-extension -- negative spec: the missing extension IS the behaviour under test
            expect(result.stdout).toMatch(file('./_expected/no-extension'), { frozen: true });
        }).toThrow(/extension is part of the path/u);
    });

    test('value exposes the parsed JSON', async () => {
        // Given - a run printing JSON
        const result = await cli
            .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
            .exec('json');

        // Then - the parsed value is readable
        expect(result.json).toMatch({
            features: ['build', 'check'],
            name: 'cli-app',
            version: '1.0.0',
        });
    });

    test('toMatch round-trips with pretty-printed JSON', async () => {
        // Given - a JSON fixture created via update mode
        const fixtureName = `json-transient-${Date.now()}.json`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            const a = await cli
                .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
                .exec('json');
            inUpdateMode(() => {
                expect(a.json).toMatch(file(`./_expected/${fixtureName}`));
            });

            // Then - the file is pretty-printed with a trailing newline
            const written = readFileSync(fixturePath, 'utf8');
            expect(written).toMatch(/^\{\n {4}"name": "cli-app"/u);
            expect(written.endsWith('\n')).toBeTruthy();

            // Then - a second identical run matches
            const b = await cli
                .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
                .exec('json');
            expect(b.json).toMatch(file(`./_expected/${fixtureName}`));
        } finally {
            removeGolden(fixturePath);
        }
    });

    test('toMatch supports placeholders in expected JSON', async () => {
        // Given - a fixture using {{string}} / {{number}} / {{any}} placeholders
        const fixtureName = `json-placeholders-${Date.now()}.json`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            mkdirSync(EXPECTED_DIR, { recursive: true });
            writeFileSync(
                fixturePath,
                `${JSON.stringify(
                    { features: '{{any}}', name: '{{string#n}}', version: '{{string}}' },
                    null,
                    4,
                )}\n`,
            );

            // Then - dynamic segments match by type
            const result = await cli
                .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
                .exec('json');
            expect(result.json).toMatch(file(`./_expected/${fixtureName}`));
        } finally {
            removeGolden(fixturePath);
        }
    });

    test('update mode preserves placeholder-covered segments', async () => {
        // Given - an existing fixture with a placeholder plus a stale literal
        const fixtureName = `json-preserve-${Date.now()}.json`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            mkdirSync(EXPECTED_DIR, { recursive: true });
            writeFileSync(
                fixturePath,
                `${JSON.stringify(
                    { features: ['build', 'check'], name: '{{string}}', version: 'STALE' },
                    null,
                    4,
                )}\n`,
            );

            // When - update mode rewrites the fixture from actual output
            const result = await cli
                .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
                .exec('json');
            inUpdateMode(() => {
                expect(result.json).toMatch(file(`./_expected/${fixtureName}`));
            });

            // Then - the placeholder survived, the stale literal was replaced
            const written = JSON.parse(readFileSync(fixturePath, 'utf8'));
            expect(written.name).toBe('{{string}}');
            expect(written.version).toBe('1.0.0');
        } finally {
            removeGolden(fixturePath);
        }
    });
});
