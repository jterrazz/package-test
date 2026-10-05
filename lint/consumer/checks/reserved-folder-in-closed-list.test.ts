import { describe, expect, test } from 'vitest';

import { packageWith } from '../../kit/testing/package-tree.fixtures.js';
import { checkReservedFolderInClosedList } from './reserved-folder-in-closed-list.js';

function foundIn(files: Record<string, string>): string[] {
    return checkReservedFolderInClosedList(packageWith(files)).map(
        ({ found, line, path, rule }) => `${path}:${line} ${found} (${rule})`,
    );
}

describe('checkReservedFolderInClosedList', () => {
    test('the pool holds reserved folders alone, and only the pool is named so', () => {
        // Given - a pool holding a reserved folder, a note and a helper folder, a pool below the root, and a subject folder named shared
        const found = foundIn({
            'specs/_shared/_fixtures/a.json': '{}\n',
            'specs/_shared/_setup/runner.ts': 'export {};\n',
            'specs/_shared/helpers/x.ts': 'export {};\n',
            'specs/_shared/notes.md': '\n',
            'specs/api/_shared/_fixtures/b.json': '{}\n',
            'specs/api/notes/notes.md': '\n',
            'specs/api/shared/list.spec.ts': "test('a', () => {});\n",
            'specs/cli/shared/x.txt': '\n',
        });

        // Then - what the pool holds besides, and each pool out of place
        expect(found).toStrictEqual([
            'specs/_shared/helpers/:1 `_shared/helpers`, which is no reserved folder (reserved-folder-in-closed-list)',
            'specs/_shared/notes.md:1 `_shared/notes.md`, which is no reserved folder (reserved-folder-in-closed-list)',
            'specs/api/_shared/:1 `_shared/` below the specs root (reserved-folder-in-closed-list)',
            'specs/cli/shared/:1 `shared/` below the specs root (reserved-folder-in-closed-list)',
        ]);
    });

    test('a reserved name without its underscore is named where no spec explains it, and nothing is judged in ground or pruned folders', () => {
        // Given - unmarked reserved names at the root, below it without and with a spec, inside ground, and inside a pruned folder
        const found = foundIn({
            'specs/api/_fixtures/seeds/a.sql': '\n',
            'specs/api/expected/list.spec.ts': "test('a', () => {});\n",
            'specs/api/fixtures/a.json': '{}\n',
            'specs/api/node_modules/doubles/x.ts': 'export {};\n',
            'specs/doubles/clock.ts': 'export {};\n',
            'specs/shared/x.ts': 'export {};\n',
        });

        // Then - the unmarked ones, each with its own remedy
        expect(found).toStrictEqual([
            'specs/api/fixtures/:1 `fixtures/`, a reserved name without its `_` and no subject: it holds no spec (reserved-folder-in-closed-list)',
            'specs/doubles/:1 `doubles/`, a reserved name without its `_` and no subject: it holds no spec (reserved-folder-in-closed-list)',
            'specs/shared/:1 `shared/`, a reserved name without its `_` and no subject: it holds no spec (reserved-folder-in-closed-list)',
        ]);
    });

    test('each refusal teaches its move', () => {
        // Given - one folder of each kind
        const fixes = checkReservedFolderInClosedList(
            packageWith({
                'specs/_shared/notes.md': '\n',
                'specs/api/_shared/a.json': '{}\n',
                'specs/api/users/_setup/_fixtures/a.json': '{}\n',
                'specs/doubles/clock.ts': 'export {};\n',
                'specs/fixtures/a.json': '{}\n',
            }),
        ).map(({ fix }) => fix);

        // Then - the remedy for each
        expect(fixes).toStrictEqual([
            '`specs/_shared/` holds reserved folders alone — code in `_shared/_setup/`, data in the ground folder of its role',
            "move what it holds into the reserved folders of `api/` itself — what a folder's leaves share sits in that folder's `_setup/` or ground; `_shared/` exists only as `specs/_shared/`, for what specifications share",
            'move it beside that `_setup/`, to `specs/api/users/_fixtures/`, and the paths that name what it holds',
            'move its modules into `_setup/`, each test adapter named for the port it replaces (`<port>.adapter.ts`), and the paths that import them',
            'rename it `_fixtures/`, and the paths that name it',
        ]);
    });

    test('a _setup folder holds code alone, wherever it sits', () => {
        // Given - setups at the root and below it, holding modules, declarations, ground, underscored folders, data and pruned output
        const found = checkReservedFolderInClosedList(
            packageWith({
                'specs/_setup/data.json': '{}\n',
                'specs/_setup/runner.ts': 'export {};\n',
                'specs/api/_setup/_fixtures/a.json': '{}\n',
                'specs/api/_setup/_private/x.ts': 'export {};\n',
                'specs/api/_setup/node_modules/x.sql': '\n',
                'specs/api/_setup/stubs/clock.ts': 'export {};\n',
                'specs/api/_setup/stubs/create.http': 'POST /x\n',
                'specs/api/_setup/stubs/types.d.ts': 'export {};\n',
                'specs/api/_setup/rows.sql': '\n',
            }),
        ).map((refusal) => `${refusal.path} ${refusal.found} — ${refusal.fix}`);

        // Then - each thing that is no code, with where it goes
        expect(found).toStrictEqual([
            'specs/_setup/data.json `data.json` inside a `_setup/`, data where code alone belongs — move it into the ground of its role beside that `_setup/` — `specs/_fixtures/data.json`, or `specs/_expected/data.json` when a test compares against it — and the paths that import or name it',
            'specs/api/_setup/_fixtures/ `_fixtures/` inside a `_setup/`, which holds code alone — move it beside that `_setup/`, to `specs/api/_fixtures/`, and the paths that name what it holds',
            'specs/api/_setup/_private/ `_private/` inside a `_setup/`, a `_` name outside the closed list — drop the `_` and name it for what it holds — the reserved folders, `_setup/`, `_expected/`, `_fixtures/`, `_requests/`, `_seeds/`, `_shared/`, sit beside a `_setup/`, never inside it',
            'specs/api/_setup/rows.sql `rows.sql` inside a `_setup/`, data where code alone belongs — move it into the ground of its role beside that `_setup/` — `specs/api/_seeds/rows.sql`, or `specs/api/_expected/rows.sql` when a test compares against it — and the paths that import or name it',
            'specs/api/_setup/stubs/create.http `create.http` inside a `_setup/`, data where code alone belongs — move it into the ground of its role beside that `_setup/` — `specs/api/_requests/create.http`, or `specs/api/_expected/create.http` when a test compares against it — and the paths that import or name it',
        ]);
    });
});
