import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../kit/testing/package-tree.fixtures.js';
import { moduleExtensionOf, pruned, rebased } from '../spec-in-subject-folder.prune.js';

const lines = (...text: string[]): string => text.join('\n');

const HOLE = ['`$', '{$read}`'].join('');

describe('spec-in-subject-folder.prune', () => {
    test('drops an import only a string of the file names', () => {
        // Given - a cut file whose test only names `cli` inside a string
        const cut = lines(
            "import { cli } from '../../cli/cli.specification.js';",
            "import { api } from '../api.specification.js';",
            "test('creates', async () => { await api.post('/orders', { from: 'cli-app' }); });",
            '',
        );

        // Then - the import the code never reads is gone
        expect(pruned(cut)).toBe(
            lines(
                "import { api } from '../api.specification.js';",
                "test('creates', async () => { await api.post('/orders', { from: 'cli-app' }); });",
                '',
            ),
        );
    });

    test('drops an import another clause only aliases, and an unread helper with its doc comment', () => {
        // Given - one handle imported twice under two names, and a documented helper no test calls
        const cut = lines(
            "import { api } from '../api.specification.js';",
            "import { api as other } from '../other.specification.js';",
            '',
            '/** Read the list twice. */',
            'function twice(): void {}',
            '',
            "test('lists', async () => { await other.get('/orders'); });",
            '',
        );

        // Then - only what the test reads is left
        expect(pruned(cut)).toBe(
            lines(
                "import { api as other } from '../other.specification.js';",
                '',
                "test('lists', async () => { await other.get('/orders'); });",
                '',
            ),
        );
    });

    test('keeps an import a spread reads, as it keeps one a call reads', () => {
        // Given - a cut file whose only read of a helper and a constant is a spread
        const cut = lines(
            "import { onlyPasses, FOLDERS } from '../setup.js';",
            "test('runs', async () => { await cli.with({ env: { ...onlyPasses('names') } }).exec([...FOLDERS].join(' ')); });",
            '',
        );

        // Then - nothing is pruned: a spread is no member access
        expect(pruned(cut)).toBe(cut);
    });

    test('keeps of each import clause only the names read, its kind, and drops a clause left empty', () => {
        // Given - default, named, type-only and trailing-comma clauses, read in part
        const cut = lines(
            "import api, { other } from '../a.js';",
            "import cli, { unread } from '../b.js';",
            "import type { Kept, Gone } from '../c.js';",
            "import { $read, $gone, } from '../d.js';",
            "import { never } from '../e.js';",
            "import both, { too } from '../f.js';",
            'const value: Kept = 1;',
            `test('reads', async () => { await other.get(${HOLE}); await cli.exec(String(value), both, too); });`,
            '',
        );

        // Then - each clause keeps what is read, in the form it was written
        expect(pruned(cut)).toBe(
            lines(
                "import { other } from '../a.js';",
                "import cli from '../b.js';",
                "import type { Kept } from '../c.js';",
                "import { $read } from '../d.js';",
                "import both, { too } from '../f.js';",
                'const value: Kept = 1;',
                `test('reads', async () => { await other.get(${HOLE}); await cli.exec(String(value), both, too); });`,
                '',
            ),
        );
    });

    test('drops each unread declaration whole, through literals, brackets and bodies, and what only it read', () => {
        // Given - unread declarations of every shape, each followed by a line that stays
        const cut = lines(
            "const message = 'a;b';",
            'const banner = `a;',
            'b`;',
            'const kept = 1;',
            'function head(',
            '    options: { a: number }',
            '): void {',
            '    return;',
            '}',
            'const alsoKept = 2;',
            'function pair(): [',
            '    { a: number }',
            '] {',
            '    return [{ a: 1 }];',
            '}',
            'interface Shape {',
            '    a: number;',
            '}',
            'const built = build(',
            '    1,',
            ')',
            '    .then(next);',
            'const base = 1;',
            'const derived = base + 1;',
            "test('reads', () => { use(kept, alsoKept); });",
            '',
        );

        // Then - only the read lines are left
        expect(pruned(cut)).toBe(
            lines(
                'const kept = 1;',
                'const alsoKept = 2;',
                "test('reads', () => { use(kept, alsoKept); });",
                '',
            ),
        );
    });

    test('a path is rebased to the new folder, a directory keeping its slash, and one inside a string or naming nothing is left', () => {
        // Given - a file moving from specs/a to specs/b/c, naming paths every way
        const root = packageWith({ 'specs/a/__fixtures__/app/x.txt': '', 'specs/a/x.json': '' });
        const text = lines(
            "import { api } from '../api.js';",
            "api.fixture(directory('./__fixtures__/app/'));",
            "api.fixture(file('./x.json'));",
            "api.fixture(directory('../'));",
            "api.fixture(directory('../a/__fixtures__/app/'));",
            'log("file(\'./x.json\')");',
            "api.fixture(file('./missing.json'));",
            "join(import.meta.dirname, './gone');",
            "await import('../mod.js');",
            '',
        );

        // Then - each existing path, and each module, is named from the new folder
        expect(rebased(text, join(root, 'specs/a'), join(root, 'specs/b/c'))).toBe(
            lines(
                "import { api } from '../../api.js';",
                "api.fixture(directory('../../a/__fixtures__/app/'));",
                "api.fixture(file('../../a/x.json'));",
                "api.fixture(directory('../..'));",
                "api.fixture(directory('../../a/__fixtures__/app/'));",
                'log("file(\'./x.json\')");',
                "api.fixture(file('./missing.json'));",
                "join(import.meta.dirname, './gone');",
                "await import('../../mod.js');",
                '',
            ),
        );
    });

    test('moduleExtensionOf — a relative module is imported as the spec imports its own: `.js` unless one of them is bare; a package import says nothing', () => {
        // Given - specs importing their relative modules with an extension, bare, both, or only packages
        const specs = [
            lines(
                "import { a } from './a.js';",
                "import { b } from '../b.mjs';",
                "import { c } from 'c';",
            ),
            lines("import { a } from './a.js';", "import { b } from '../b';"),
            lines("import { c } from 'c';", "import { d } from 'd/e';"),
            lines("import { a } from './a.cjs';"),
        ];

        // Then - the extension each one writes
        expect(specs.map((text) => moduleExtensionOf(text))).toStrictEqual([
            '.js',
            '',
            '.js',
            '.js',
        ]);
    });
});
