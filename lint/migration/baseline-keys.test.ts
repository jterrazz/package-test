import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { migrateBaselineKeys } from './baseline-keys.js';

function project(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'baseline-keys-'));
    for (const [name, content] of Object.entries(files)) {
        writeFileSync(join(root, name), content);
    }
    return root;
}

describe('migrateBaselineKeys', () => {
    test('baseline-keys — a code of one pass takes its name, a code several passes shared is left to the baseline gesture, and two keys landing on one name add up', () => {
        // Given - a test section keyed by 17.0 codes, one shared by four passes, and a name already beside its old code
        const root = project({
            'jterrazz.baseline.json': `${JSON.stringify(
                {
                    typescript: { 'eslint/complexity': 3 },
                    test: {
                        'jterrazz-check/c9': 2,
                        'jterrazz-check/d4b': 1,
                        'jterrazz/j2-no-sleep': 1,
                        'jterrazz/no-sleep': 2,
                        'routes/unreached': 4,
                    },
                },
                null,
                4,
            )}\n`,
        });

        // When - the keys move
        const moves = migrateBaselineKeys(root);

        // Then - each renamed key is reported, the shared one named for the gesture, and the other sections kept
        expect(moves).toStrictEqual([
            {
                file: 'jterrazz.baseline.json',
                renamed: ['jterrazz-check/c9', 'jterrazz/j2-no-sleep'],
                shared: ['jterrazz-check/d4b'],
            },
        ]);
        const written: unknown = JSON.parse(
            readFileSync(join(root, 'jterrazz.baseline.json'), 'utf8'),
        );
        expect(written).toStrictEqual({
            typescript: { 'eslint/complexity': 3 },
            test: {
                'jterrazz-check/d4b': 1,
                'jterrazz-check/no-unused-ground': 2,
                'jterrazz/no-sleep': 3,
                'routes/unreached': 4,
            },
        });
    });

    test('baseline-keys — a legacy flat baseline is renamed in place, and a project already on names is left untouched', () => {
        // Given - a member still on oxlint.baseline.json, and a project whose keys are names
        const legacy = project({
            'oxlint.baseline.json':
                '{\n    "eslint/complexity": 1,\n    "jterrazz-check/c18": 2\n}\n',
        });
        const named = project({
            'jterrazz.baseline.json':
                '{\n    "test": {\n        "jterrazz/no-sleep": 1\n    }\n}\n',
        });

        // When - the keys move in both
        const moved = migrateBaselineKeys(legacy);
        const untouched = migrateBaselineKeys(named);

        // Then - the legacy key names its pass, and nothing else is written
        expect(moved).toStrictEqual([
            { file: 'oxlint.baseline.json', renamed: ['jterrazz-check/c18'], shared: [] },
        ]);
        expect(readFileSync(join(legacy, 'oxlint.baseline.json'), 'utf8')).toBe(
            '{\n    "eslint/complexity": 1,\n    "jterrazz-check/facet-test-uses-its-runner": 2\n}\n',
        );
        expect(untouched).toStrictEqual([]);
        expect(readFileSync(join(named, 'jterrazz.baseline.json'), 'utf8')).toBe(
            '{\n    "test": {\n        "jterrazz/no-sleep": 1\n    }\n}\n',
        );
    });
});
