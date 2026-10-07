import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../testing/package-tree.fixtures.js';
import { anchoredPaths, collectFixtureReferences } from '../named-paths.js';
import { DISK_CALL } from '../tree.js';

/** A template hole, spelled so the templates of this file do not read it as one. */
const HOLE = ['$', '{name}'].join('');

const SPEC = [
    "await api.fixture(file('./__fixtures__/one.json'));",
    'await api.fixture(directory("../__fixtures__/tree/"));',
    `await api.fixture(file(\`./__fixtures__/${HOLE}.json\`));`,
    "await api.fixture(file('/abs/__fixtures__/a.json'));",
    "await api.fixture(file('__fixtures__/bare.json'));",
    "await api.fixture(file(''));",
    'const said = "api.fixture(file(\'./__fixtures__/quoted.json\'))";',
    "const read = file('./__expected__/read.json');",
    '',
].join('\n');

const ANCHORED = [
    "const a = resolve(import.meta.dirname, '../__expected__');",
    "const b = resolve(import.meta.dirname, '__expected__');",
    "const c = join(import.meta.dirname, '__fixtures__', 'one.json');",
    "const d = resolve(import.meta.dirname, '/etc', 'hosts');",
    "const e = new URL('./__fixtures__/two.json', import.meta.url);",
    '',
].join('\n');

describe('named-paths', () => {
    test('collectFixtureReferences — each fixture a spec names whole and relative, at its quote, with its kind', () => {
        // Given - a spec naming fixtures each way, some not whole, not relative, or inside a string
        const root = packageWith({ 'specs/api/users.spec.ts': SPEC });
        const file = join(root, 'specs/api/users.spec.ts');

        // Then - the fixture calls, then every disk call outside strings
        expect([
            collectFixtureReferences(file).map(
                ({ column, kind, line, path }) => `${line}:${column} ${kind} ${path}`,
            ),
            collectFixtureReferences(file, DISK_CALL, true).map(
                ({ line, path }) => `${line} ${path}`,
            ),
        ]).toStrictEqual([
            [
                '1:24 file ./__fixtures__/one.json',
                '2:29 directory ../__fixtures__/tree/',
                '7:32 file ./__fixtures__/quoted.json',
            ],
            ['1 ./__fixtures__/one.json', '2 ../__fixtures__/tree/', '8 ./__expected__/read.json'],
        ]);
    });

    test('collectFixtureReferences — a document names its fixtures by its fixture: list', () => {
        // Given - a document naming a fixture tree, and one that does not parse
        const root = packageWith({
            'specs/cli/broken.spec.yaml': 'runs: [\n',
            'specs/cli/case.spec.yaml':
                'description: lays a tree\nfixture: ./__fixtures__/tree/\nruns:\n  - command: a\n    exit: 0\n',
        });

        // Then - the fixture of the one that parses, keyed
        expect(
            ['case', 'broken'].map((name) =>
                collectFixtureReferences(join(root, `specs/cli/${name}.spec.yaml`)).map(
                    ({ column, key, kind, line, path }) =>
                        `${line}:${column} ${key} ${kind} ${path}`,
                ),
            ),
        ).toStrictEqual([['2:1 fixture directory ./__fixtures__/tree/'], []]);
    });

    test('anchoredPaths — a path built from the module’s own folder, past a lone bare piece and an absolute one', () => {
        // Given - paths anchored on import.meta, written each way, and a module that does not parse
        const root = packageWith({ 'src/broken.ts': 'const = ;\n', 'src/paths.ts': ANCHORED });

        // Then - the anchored paths, where they start and what they name
        expect([
            anchoredPaths(join(root, 'src/paths.ts')).map(
                ({ column, line, named, target }) =>
                    `${line}:${column} ${named} → ${relative(root, target)}`,
            ),
            anchoredPaths(join(root, 'src/broken.ts')),
        ]).toStrictEqual([
            [
                "1:40 '../__expected__' → __expected__",
                "3:37 '__fixtures__', 'one.json' → src/__fixtures__/one.json",
                "5:19 './__fixtures__/two.json' → src/__fixtures__/two.json",
            ],
            [],
        ]);
    });
});
