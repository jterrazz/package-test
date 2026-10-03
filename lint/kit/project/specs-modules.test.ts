import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../testing/package-tree.fixtures.js';
import {
    holdsASpec,
    importedModulesOf,
    importsThroughAlias,
    isModuleName,
    lowestPlaceOf,
    modulesUnder,
    placeOf,
    readersOf,
    refusedReservedAbove,
} from './specs-modules.js';

const TREE = {
    'package.json': JSON.stringify({ imports: { '#setup/*': './specs/_shared/_setup/*' } }),
    'specs/_shared/_setup/world.ts': 'export const world = 1;\n',
    'specs/api/_setup/local.ts': 'export const local = 1;\n',
    'specs/api/_setup/seed.ts':
        "import { local } from './local.ts';\nimport { world } from '#setup/world.ts';\nexport const seed = world + local;\n",
    'specs/api/_expected/shape.ts': 'export const shape = 1;\n',
    'specs/api/node_modules/dep/index.ts': '',
    'specs/api/types.d.ts': 'export type A = 1;\n',
    'specs/api/users/users.spec.ts':
        "import { seed } from '../_setup/seed.ts';\nimport { world } from '../../_shared/_setup/world.ts';\nimport './users.spec.ts';\n",
    'specs/api/broken.ts': 'const = ;\n',
};

describe('specs-modules', () => {
    test('isModuleName and modulesUnder — the source modules of a tree, past declarations, ground and dependencies', () => {
        // Given - a tree of modules, a declaration file, a module in ground and one in a dependency
        const root = packageWith(TREE);

        // Then - the modules a walk reads
        expect([
            ['a.ts', 'a.mjs', 'a.tsx', 'a.d.ts', 'a.json'].map((name) => isModuleName(name)),
            modulesUnder(join(root, 'specs'))
                .map((path) => relative(root, path))
                .toSorted(),
        ]).toStrictEqual([
            [true, true, true, false, false],
            [
                'specs/_shared/_setup/world.ts',
                'specs/api/_setup/local.ts',
                'specs/api/_setup/seed.ts',
                'specs/api/broken.ts',
                'specs/api/users/users.spec.ts',
            ],
        ]);
    });

    test('placeOf and lowestPlaceOf — a reader stands at its folder, or at the owner of the setup it sits in', () => {
        // Given - readers in a leaf, in a folder's setup and in the shared setup
        const specs = join('/repo', 'specs');
        const readers = [
            'api/users/a.spec.ts',
            'api/_setup/seed.ts',
            '_shared/_setup/world.ts',
        ].map((path) => join(specs, path));

        // Then - the place of each, and the lowest they share
        expect([
            readers.map((reader) => relative(specs, placeOf(specs, reader)) || '.'),
            lowestPlaceOf(specs, readers.slice(0, 2)),
            lowestPlaceOf(specs, readers),
        ]).toStrictEqual([['api/users', 'api', '.'], join(specs, 'api'), specs]);
    });

    test('importedModulesOf, importsThroughAlias and readersOf — what each module imports, by path or alias, and who reads it', () => {
        // Given - the tree
        const root = packageWith(TREE);
        const at = (path: string): string => join(root, path);
        const modules = modulesUnder(at('specs'));

        // Then - the imports of a spec, the alias a setup reads through, and the readers of each module
        expect([
            importedModulesOf(at('specs/api/users/users.spec.ts')).map((path) =>
                relative(root, path),
            ),
            importedModulesOf(at('specs/api/broken.ts')),
            importsThroughAlias(
                at('specs/api/_setup/seed.ts'),
                at('specs/_shared/_setup/world.ts'),
            ),
            importsThroughAlias(
                at('specs/api/users/users.spec.ts'),
                at('specs/_shared/_setup/world.ts'),
            ),
            Object.fromEntries(
                [...readersOf(modules)].map(([module, readers]) => [
                    relative(root, module),
                    readers.map((reader) => relative(root, reader)),
                ]),
            ),
        ]).toStrictEqual([
            [
                'specs/api/_setup/seed.ts',
                'specs/_shared/_setup/world.ts',
                'specs/api/users/users.spec.ts',
            ],
            [],
            true,
            false,
            {
                'specs/_shared/_setup/world.ts': [
                    'specs/api/_setup/seed.ts',
                    'specs/api/users/users.spec.ts',
                ],
                'specs/api/_setup/local.ts': ['specs/api/_setup/seed.ts'],
                'specs/api/_setup/seed.ts': ['specs/api/users/users.spec.ts'],
            },
        ]);
    });

    test('holdsASpec — a folder holds a spec when one sits in it or below, outside the reserved and pruned folders', () => {
        // Given - folders holding specs at each depth, and specs only in places that do not count
        const root = packageWith({
            'deep/a/b/case.spec.yaml': '',
            'direct/a.spec.ts': '',
            'hidden/_setup/a.spec.ts': '',
            'hidden/node_modules/x/a.test.ts': '',
            'hidden/notes.md': '',
            'mixed/a.ts': '',
            'mixed/sub/a.test.ts': '',
        });

        // Then - which hold one
        expect(
            ['deep', 'direct', 'hidden', 'mixed', 'missing'].map((name) =>
                holdsASpec(join(root, name)),
            ),
        ).toStrictEqual([true, true, false, true, false]);
    });

    test('refusedReservedAbove — the first folder above a file that is an unknown underscore name, a shared folder below the root, or an unmarked reserved name', () => {
        // Given - files under each kind of refused folder, and under accepted ones
        const root = packageWith({
            'specs/api/_helpers/a.ts': '',
            'specs/api/_shared/a.ts': '',
            'specs/api/fixtures/a.json': '',
            'specs/api/setup/a.spec.ts': '',
            'specs/_shared/_setup/a.ts': '',
            'specs/api/users/a.spec.ts': '',
            'specs/expected/a.json': '',
            'specs/setup/a.spec.ts': '',
        });
        const specs = join(root, 'specs');

        // Then - the refused folder above each, or none
        expect(
            [
                'api/_helpers/a.ts',
                'api/_shared/a.ts',
                'api/fixtures/a.json',
                'api/setup/a.spec.ts',
                '_shared/_setup/a.ts',
                'api/users/a.spec.ts',
                'expected/a.json',
                'setup/a.spec.ts',
            ].map((path) => {
                const refused = refusedReservedAbove(specs, join(specs, path));
                return refused === undefined ? undefined : relative(specs, refused);
            }),
        ).toStrictEqual([
            'api/_helpers',
            'api/_shared',
            'api/fixtures',
            undefined,
            undefined,
            undefined,
            'expected',
            'setup',
        ]);
    });
});
