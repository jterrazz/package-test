import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { checkGroundSharedOrInline, fixGroundSharedOrInline } from '../ground-shared-or-inline.js';
import {
    EXPECTED,
    lines,
    READ_ALONE,
    readAlone,
    REQUEST,
    SPEC,
    STAYS_A_FILE,
    testReading,
    USERS,
} from './ground-shared-or-inline.fixtures.js';

function findingsIn(files: Record<string, string>): string[] {
    return checkGroundSharedOrInline(packageWith(files)).map(
        ({ column, fix, found, line, path, rule }) =>
            `${path}:${line}:${column ?? '-'} ${found} — ${fix}${rule === 'ground-shared-or-inline' ? '' : ' (misfiled)'}`,
    );
}

describe('ground-shared-or-inline', () => {
    test('a ground file one test alone reads is to be written in place', () => {
        // Given - a spec whose one test compares against an expected file
        // Then - the file is named at the call, with the form it takes in place
        expect(
            findingsIn({ ...EXPECTED, [SPEC]: testReading("file('./__expected__/users.json')") }),
        ).toStrictEqual(READ_ALONE);
    });

    test("a module test's golden inside its __tests__/ is judged as a spec's, and one beside a module test of the old layout is not this rule's", () => {
        // Given - a module test reading a golden of its __tests__/, and a test beside its module reading a golden beside it
        const found = findingsIn({
            [SPEC]: "test('lists', () => {});\n",
            'src/legacy/__expected__/old.txt': 'old\n',
            'src/legacy/legacy.test.ts': testReading("file('./__expected__/old.txt')"),
            'src/render/__tests__/__expected__/notes.txt': 'notes\n',
            'src/render/__tests__/heading.test.ts': testReading("file('./__expected__/notes.txt')"),
        });

        // Then - the golden of the __tests__/ alone is to be written in place
        expect(found.map((line) => line.split(' — ')[0])).toStrictEqual([
            'src/render/__tests__/heading.test.ts:2:39 src/render/__tests__/__expected__/notes.txt, read by this test alone',
        ]);
    });

    test('a file that is no module, naming the path in its text, reads nothing', () => {
        // Given - the file read alone, and a JSON note quoting an import of it
        const files = {
            ...EXPECTED,
            [SPEC]: testReading(USERS),
            'specs/api/notes.json': `${JSON.stringify({ note: "import users from './__expected__/users.json'" })}\n`,
        };

        // Then - the file is still to be written in place
        expect(findingsIn(files)).toStrictEqual(READ_ALONE);
    });

    test.each(STAYS_A_FILE)('a ground file stays a file when %s', (_, files) => {
        // Given - a tree where the file is shared, unwritable in place, silenced or not a ground file
        // Then - nothing is to inline
        expect(findingsIn(files)).toStrictEqual([]);
    });

    test('a file read alone is to be inlined at its cap, as one line when it is no JSON file, and twice in one test', () => {
        // Given - expected text at the cap, a one-line array in a text file, and a test naming its file twice
        const atCap = findingsIn({
            'specs/api/__expected__/users.json': lines(150),
            [SPEC]: testReading(USERS),
        });
        const oneLine = findingsIn({
            'specs/api/__expected__/users.txt': `${JSON.stringify(Array.from({ length: 150 }, (_, at) => at))}\n`,
            [SPEC]: testReading("file('./__expected__/users.txt')"),
        });
        const twice = findingsIn({
            ...EXPECTED,
            [SPEC]: testReading(`${USERS}).toMatch(${USERS}`),
        });

        // Then - each is read by that test alone
        expect([atCap, oneLine, twice]).toStrictEqual([
            READ_ALONE,
            readAlone('users.txt'),
            READ_ALONE,
        ]);
    });

    test('a request read alone is written in place as the request, and a parameterised test is one test', () => {
        // Given - a request at its cap, read by a test.each
        const found = findingsIn({
            'specs/api/__requests__/create.http': lines(30),
            [SPEC]: REQUEST.replace("test('creates'", "test.each([1, 2])('creates %i'"),
        });

        // Then - the form in place is the request or its body
        expect(found).toStrictEqual([
            'specs/api/users.spec.ts:2:23 specs/api/__requests__/create.http, read by this test alone — write it here, the request or its body, and delete the file — `typescript fix` inlines it',
        ]);
    });

    test('a pool file one test reads is inlined, not moved, and a pool folder is moved', () => {
        // Given - a pool expected file and a pool fixture folder, each read by the users test alone
        const found = findingsIn({
            'specs/__expected__/users.json': '[]\n',
            'specs/__fixtures__/app/index.txt': 'app\n',
            [SPEC]: `${testReading("file('../__expected__/users.json')")}api.fixture(directory('../__fixtures__/app/'));\n`,
        });

        // Then - the file is to inline, and only the folder is to move
        expect(found).toStrictEqual([
            'specs/api/users.spec.ts:2:39 specs/__expected__/users.json, read by this test alone — write it here, the value `toMatch` compares, and delete the file — `typescript fix` inlines it',
            "specs/__fixtures__/app:1:- ground only specs/api reaches for, kept above it — move it to specs/api/__fixtures__/app and name it directory('./__fixtures__/app/') — `typescript fix` does both",
        ]);
    });

    test('a spec module of any extension is read, a JSON file never, and a module test naming the specs or another file shares nothing', () => {
        // Given - the users test as an .mts spec, beside a JSON note and module tests naming the specs root and another file
        const found = findingsIn({
            ...EXPECTED,
            'specs/api/notes.json': `{ "seen": "${USERS}" }\n`,
            'specs/api/users.spec.mts': testReading(USERS),
            'src/users.test.ts': "read('../specs', '../specs/api/__expected__/other.json');\n",
        });

        // Then - the file is still read by that test alone
        expect(found).toStrictEqual([
            'specs/api/users.spec.mts:2:39 specs/api/__expected__/users.json, read by this test alone — write it here, the value `toMatch` compares, and delete the file — `typescript fix` inlines it',
        ]);
    });

    test('a request written in the test past its cap is named with the file to move it to', () => {
        // Given - a request of thirty-one lines written inline
        const body = lines(31)
            .trimEnd()
            .split('\n')
            .map((line) => `        ${line}`)
            .join('\n');
        const found = findingsIn({
            [SPEC]: `test('creates', async () => {\n    await api.request(\`\n${body}\n    \`);\n});\n`,
        });

        // Then - the cap is named
        expect(found).toStrictEqual([
            "specs/api/users.spec.ts:2:23 a request of 31 lines written in the test, past the __requests__/ cap of 30 — move it to ./__requests__/creates.http and name it with file('./__requests__/creates.http') — `typescript fix` moves it",
        ]);
    });

    test('the fix writes a file one test reads once in its place, and leaves one it reads twice', () => {
        // Given - one test reading its expected file once, another reading its own twice
        const root = packageWith({
            ...EXPECTED,
            'specs/api/__expected__/pages.json': '[1]\n',
            'specs/api/pages.spec.ts': testReading(
                "file('./__expected__/pages.json')).toMatch(file('./__expected__/pages.json')",
            ),
            [SPEC]: testReading(USERS),
        });

        // When - the fixer runs
        const done = fixGroundSharedOrInline(root);

        // Then - the users file is inlined in place and the pages file kept
        expect([done, readFileSync(join(root, SPEC), 'utf8')]).toStrictEqual([
            ['inlined specs/api/__expected__/users.json → specs/api/users.spec.ts:2'],
            testReading('`\n        []\n    `'),
        ]);
    });

    test('the fix inlines each file of a spec from the last, indented, drops the emptied folders and the unused import, and reports every pass', () => {
        // Given - a spec whose two tests read their own files, one nested, an oversized request elsewhere, and a pool folder one leaf reads
        const root = packageWith({
            'specs/__fixtures__/app/index.txt': 'app\n',
            'specs/api/__expected__/deep/pages.txt': 'p\n',
            'specs/api/__expected__/users.txt': 'a\nb\n',
            'specs/cli/boot.spec.ts': "cli.fixture(directory('../__fixtures__/app/'));\n",
            'specs/cli/create.spec.ts': `test('creates', async () => {\n    await api.request(\`\n${lines(31).trimEnd().replaceAll(/^/gmu, '        ')}\n    \`);\n});\n`,
            [SPEC]: [
                "import { file } from '@jterrazz/test';",
                '',
                "describe('users', () => {",
                "    test('pages users', async () => {",
                "        await expect(result.body).toMatch(file('./__expected__/deep/pages.txt'));",
                '    });',
                "    test('lists users', async () => {",
                "        await expect(result.body).toMatch(file('./__expected__/users.txt'));",
                '    });',
                '});',
                '',
            ].join('\n'),
        });

        // When - the fixer runs
        const done = fixGroundSharedOrInline(root);

        // Then - both written in place at their indentation, the folders and the import gone, each pass reported
        expect([
            done,
            readFileSync(join(root, SPEC), 'utf8'),
            existsSync(join(root, 'specs/api/__expected__')),
        ]).toStrictEqual([
            [
                'wrote specs/cli/create.spec.ts:2 → specs/cli/__requests__/creates.http',
                'inlined specs/api/__expected__/users.txt → specs/api/users.spec.ts:8',
                'inlined specs/api/__expected__/deep/pages.txt → specs/api/users.spec.ts:5',
                'moved specs/__fixtures__/app → specs/cli/__fixtures__/app',
            ],
            [
                '',
                "describe('users', () => {",
                "    test('pages users', async () => {",
                '        await expect(result.body).toMatch(`',
                '            p',
                '        `);',
                '    });',
                "    test('lists users', async () => {",
                '        await expect(result.body).toMatch(`',
                '            a',
                '            b',
                '        `);',
                '    });',
                '});',
                '',
            ].join('\n'),
            false,
        ]);
    });

    test('the fix keeps the import a remaining call needs, a folder still holding a file, and a read it cannot write in place', () => {
        // Given - one inlinable file beside a shared one, and a file a fixture call reads
        const root = packageWith({
            'specs/api/__expected__/shared.txt': 's\n',
            'specs/api/__expected__/users.txt': 'u\n',
            'specs/api/__requests__/seed.http': 'GET /\n',
            [SPEC]: [
                "import { file } from '@jterrazz/test';",
                testReading("file('./__expected__/users.txt')"),
                testReading("file('./__expected__/shared.txt')", 'a'),
                testReading("file('./__expected__/shared.txt')", 'b'),
                "test('seeds', () => api.fixture(file('./__requests__/seed.http')));",
                '',
            ].join('\n'),
        });

        // When - the fixer runs
        const done = fixGroundSharedOrInline(root);

        // Then - only the users file is inlined, and what still reads a file is kept
        expect([
            done,
            readFileSync(join(root, SPEC), 'utf8').split('\n')[0],
            existsSync(join(root, 'specs/api/__expected__/shared.txt')),
            existsSync(join(root, 'specs/api/__requests__/seed.http')),
        ]).toStrictEqual([
            ['inlined specs/api/__expected__/users.txt → specs/api/users.spec.ts:3'],
            "import { file } from '@jterrazz/test';",
            true,
            true,
        ]);
    });

    test('a golden compared frozen stays a file for the checker and the fixer alike', () => {
        // Given - a text golden the one test compares with its bytes stated as the contract
        const files = {
            'specs/api/__expected__/serialized.txt': '{\n  "a": 1\n}\n',
            [SPEC]: testReading("file('./__expected__/serialized.txt'), { frozen: true }"),
        };

        // Then - nothing to inline, and the fixer leaves the file where it is
        const root = packageWith(files);
        const moves = fixGroundSharedOrInline(root);
        expect([
            findingsIn(files),
            moves,
            existsSync(join(root, 'specs/api/__expected__/serialized.txt')),
        ]).toStrictEqual([[], [], true]);
    });

    test('a golden that is a byte copy of a source is compared with the source, and the fixer leaves it', () => {
        // Given - a golden holding exactly the bytes of a file the repository keeps, read by one test
        const files = {
            'docs/sample.md': '# Sample\n\nA page.\n',
            'specs/api/__expected__/sample.md': '# Sample\n\nA page.\n',
            [SPEC]: testReading("file('./__expected__/sample.md')"),
        };

        // When - it is checked, then fixed
        const found = findingsIn(files);
        const root = packageWith(files);
        const moves = fixGroundSharedOrInline(root);

        // Then - the finding names the source to compare with, and nothing is inlined or deleted
        expect([
            found,
            moves,
            existsSync(join(root, 'specs/api/__expected__/sample.md')),
        ]).toStrictEqual([
            [
                'specs/api/users.spec.ts:2:39 specs/api/__expected__/sample.md, a byte copy of docs/sample.md, read by this test alone — compare with the source: read docs/sample.md instead, and delete the copy — `typescript fix` leaves it to you',
            ],
            [],
            true,
        ]);
    });
});
