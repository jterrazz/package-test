import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { checkReservedFolderInClosedList } from '../reserved-folder-in-closed-list.js';

function foundIn(files: Record<string, string>): string[] {
    return checkReservedFolderInClosedList(packageWith(files)).map(
        ({ found, line, path, rule }) => `${path}:${line} ${found} (${rule})`,
    );
}

describe('checkReservedFolderInClosedList', () => {
    test('a shared folder holding no spec is refused, a subject named shared passes, and a `_` name is left to the closed list', () => {
        // Given - the special folders at the root, an earlier `_shared/`, a subject folder named shared, and a shared folder holding data alone
        const found = foundIn({
            'specs/__fixtures__/a.json': '{}\n',
            'specs/__setup__/runner.ts': 'export {};\n',
            'specs/_shared/helpers/x.ts': 'export {};\n',
            'specs/api/__fixtures__/b.json': '{}\n',
            'specs/api/notes/notes.md': '\n',
            'specs/api/shared/list.spec.ts': "test('a', () => {});\n",
            'specs/cli/shared/x.txt': '\n',
        });

        // Then - the shared folder that holds no spec
        expect(found).toStrictEqual([
            'specs/cli/shared/:1 `shared/`, a folder of what several specifications share, and no subject: it holds no spec (reserved-folder-in-closed-list)',
        ]);
    });

    test('a special name without its marks is named where no spec explains it, and nothing is judged in ground or pruned folders', () => {
        // Given - unmarked special names at the root, below it without and with a spec, inside ground, and inside a pruned folder
        const found = foundIn({
            'specs/api/__fixtures__/seeds/a.sql': '\n',
            'specs/api/expected/list.spec.ts': "test('a', () => {});\n",
            'specs/api/fixtures/a.json': '{}\n',
            'specs/api/node_modules/doubles/x.ts': 'export {};\n',
            'specs/doubles/clock.ts': 'export {};\n',
            'specs/shared/x.ts': 'export {};\n',
        });

        // Then - the unmarked ones, each with its own remedy
        expect(found).toStrictEqual([
            'specs/api/fixtures/:1 `fixtures/`, a special folder spelt without its marks, and no subject: it holds no spec (reserved-folder-in-closed-list)',
            'specs/doubles/:1 `doubles/`, a special folder spelt without its marks, and no subject: it holds no spec (reserved-folder-in-closed-list)',
            'specs/shared/:1 `shared/`, a folder of what several specifications share, and no subject: it holds no spec (reserved-folder-in-closed-list)',
        ]);
    });

    test('each refusal teaches its move', () => {
        // Given - one folder of each kind, and a shared folder at the specs root holding a spec
        const fixes = checkReservedFolderInClosedList(
            packageWith({
                'specs/api/shared/a.json': '{}\n',
                'specs/api/users/__setup__/__fixtures__/a.json': '{}\n',
                'specs/doubles/clock.ts': 'export {};\n',
                'specs/fixtures/a.json': '{}\n',
                'specs/shared/list.spec.ts': "test('a', () => {});\n",
            }),
        ).map(({ fix }) => fix);

        // Then - the remedy for each
        expect(fixes).toStrictEqual([
            "move what it holds into the special folders of `specs/api/` itself — what the leaves of a folder share sits in that folder's `__setup__/` or ground, `specs/__setup__/` and the ground at the specs root for what specifications share",
            'move it beside that `__setup__/`, to `specs/api/users/__fixtures__/`, and the paths that name what it holds',
            'move its modules into `__setup__/`, each test adapter named for the port it replaces (`<port>.adapter.ts`), and the paths that import them',
            'rename it `__fixtures__/`, and the paths that name it',
            "move what it holds into the special folders of `specs/` itself — what the leaves of a folder share sits in that folder's `__setup__/` or ground, `specs/__setup__/` and the ground at the specs root for what specifications share",
        ]);
    });

    test('a __setup__ folder holds code alone, wherever it sits', () => {
        // Given - setups at the root and below it, holding modules, declarations, ground, underscored folders, data and pruned output
        const found = checkReservedFolderInClosedList(
            packageWith({
                'specs/__setup__/__seeds__/rows.sql': '\n',
                'specs/__setup__/data.json': '{}\n',
                'specs/__setup__/runner.ts': 'export {};\n',
                'specs/api/__setup__/__fixtures__/a.json': '{}\n',
                'specs/api/__setup__/_private/x.ts': 'export {};\n',
                'specs/api/__setup__/node_modules/x.sql': '\n',
                'specs/api/__setup__/stubs/clock.ts': 'export {};\n',
                'specs/api/__setup__/stubs/create.http': 'POST /x\n',
                'specs/api/__setup__/stubs/types.d.ts': 'export {};\n',
                'specs/api/__setup__/rows.sql': '\n',
            }),
        ).map((refusal) => `${refusal.path} ${refusal.found} — ${refusal.fix}`);

        // Then - each thing that is no code, with where it goes
        expect(found).toStrictEqual([
            'specs/__setup__/__seeds__/ `__seeds__/` inside a `__setup__/`, which holds code alone — move it beside that `__setup__/`, to `specs/__seeds__/`, and the paths that name what it holds',
            'specs/__setup__/data.json `data.json` inside a `__setup__/`, data where code alone belongs — move it into the ground of its role beside that `__setup__/` — `specs/__fixtures__/data.json`, or `specs/__expected__/data.json` when a test compares against it — and the paths that import or name it',
            'specs/api/__setup__/__fixtures__/ `__fixtures__/` inside a `__setup__/`, which holds code alone — move it beside that `__setup__/`, to `specs/api/__fixtures__/`, and the paths that name what it holds',
            "specs/api/__setup__/_private/ `_private/` inside a `__setup__/`, where every folder is the code's own — drop the `_` and name it for what it holds — the special folders, `__setup__/`, `__expected__/`, `__fixtures__/`, `__requests__/`, `__seeds__/`, sit beside a `__setup__/`, never inside it",
            'specs/api/__setup__/rows.sql `rows.sql` inside a `__setup__/`, data where code alone belongs — move it into the ground of its role beside that `__setup__/` — `specs/api/__seeds__/rows.sql`, or `specs/api/__expected__/rows.sql` when a test compares against it — and the paths that import or name it',
            'specs/api/__setup__/stubs/create.http `create.http` inside a `__setup__/`, data where code alone belongs — move it into the ground of its role beside that `__setup__/` — `specs/api/__requests__/create.http`, or `specs/api/__expected__/create.http` when a test compares against it — and the paths that import or name it',
        ]);
    });
});
