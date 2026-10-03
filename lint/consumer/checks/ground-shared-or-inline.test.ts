import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../kit/testing/package-tree.fixtures.js';
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
import { checkGroundSharedOrInline, fixGroundSharedOrInline } from './ground-shared-or-inline.js';

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
            findingsIn({ ...EXPECTED, [SPEC]: testReading("file('./_expected/users.json')") }),
        ).toStrictEqual(READ_ALONE);
    });

    test.each(STAYS_A_FILE)('a ground file stays a file when %s', (_, files) => {
        // Given - a tree where the file is shared, unwritable in place, silenced or not a ground file
        // Then - nothing is to inline
        expect(findingsIn(files)).toStrictEqual([]);
    });

    test('a file read alone is to be inlined at its cap, as one line when it is no JSON file, and twice in one test', () => {
        // Given - expected text at the cap, a one-line array in a text file, and a test naming its file twice
        const atCap = findingsIn({
            'specs/api/_expected/users.json': lines(150),
            [SPEC]: testReading(USERS),
        });
        const oneLine = findingsIn({
            'specs/api/_expected/users.txt': `${JSON.stringify(Array.from({ length: 150 }, (_, at) => at))}\n`,
            [SPEC]: testReading("file('./_expected/users.txt')"),
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
            'specs/api/_requests/create.http': lines(30),
            [SPEC]: REQUEST.replace("test('creates'", "test.each([1, 2])('creates %i'"),
        });

        // Then - the form in place is the request or its body
        expect(found).toStrictEqual([
            'specs/api/users.spec.ts:2:23 specs/api/_requests/create.http, read by this test alone — write it here, the request or its body, and delete the file — `typescript fix` inlines it',
        ]);
    });

    test('a pool file one test reads is inlined, not moved, and a pool folder is moved', () => {
        // Given - a pool expected file and a pool fixture folder, each read by the users test alone
        const found = findingsIn({
            'specs/_shared/_expected/users.json': '[]\n',
            'specs/_shared/_fixtures/app/index.txt': 'app\n',
            [SPEC]: `${testReading("file('../_shared/_expected/users.json')")}api.fixture(directory('../_shared/_fixtures/app/'));\n`,
        });

        // Then - the file is to inline, and only the folder is to move
        expect(found).toStrictEqual([
            'specs/api/users.spec.ts:2:39 specs/_shared/_expected/users.json, read by this test alone — write it here, the value `toMatch` compares, and delete the file — `typescript fix` inlines it',
            "specs/_shared/_fixtures/app:1:- ground only specs/api reaches for, kept above it — move it to specs/api/_fixtures/app and name it directory('./_fixtures/app/') — `typescript fix` does both",
        ]);
    });

    test('a spec module of any extension is read, a JSON file never, and a module test naming the specs or another file shares nothing', () => {
        // Given - the users test as an .mts spec, beside a JSON note and module tests naming the specs root and another file
        const found = findingsIn({
            ...EXPECTED,
            'specs/api/notes.json': `{ "seen": "${USERS}" }\n`,
            'specs/api/users.spec.mts': testReading(USERS),
            'src/users.test.ts': "read('../specs', '../specs/api/_expected/other.json');\n",
        });

        // Then - the file is still read by that test alone
        expect(found).toStrictEqual([
            'specs/api/users.spec.mts:2:39 specs/api/_expected/users.json, read by this test alone — write it here, the value `toMatch` compares, and delete the file — `typescript fix` inlines it',
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
            "specs/api/users.spec.ts:2:23 a request of 31 lines written in the test, past the _requests/ cap of 30 — move it to ./_requests/creates.http and name it with file('./_requests/creates.http') — `typescript fix` moves it",
        ]);
    });

    test('the fix writes a file one test reads once in its place, and leaves one it reads twice', () => {
        // Given - one test reading its expected file once, another reading its own twice
        const root = packageWith({
            ...EXPECTED,
            'specs/api/_expected/pages.json': '[1]\n',
            'specs/api/pages.spec.ts': testReading(
                "file('./_expected/pages.json')).toMatch(file('./_expected/pages.json')",
            ),
            [SPEC]: testReading(USERS),
        });

        // When - the fixer runs
        const done = fixGroundSharedOrInline(root);

        // Then - the users file is inlined in place and the pages file kept
        expect([done, readFileSync(join(root, SPEC), 'utf8')]).toStrictEqual([
            ['inlined specs/api/_expected/users.json → specs/api/users.spec.ts:2'],
            testReading('`\n        []\n    `'),
        ]);
    });

    test('the fix inlines each file of a spec from the last, indented, drops the emptied folders and the unused import, and reports every pass', () => {
        // Given - a spec whose two tests read their own files, one nested, an oversized request elsewhere, and a pool folder one leaf reads
        const root = packageWith({
            'specs/_shared/_fixtures/app/index.txt': 'app\n',
            'specs/api/_expected/deep/pages.txt': 'p\n',
            'specs/api/_expected/users.txt': 'a\nb\n',
            'specs/cli/boot.spec.ts': "cli.fixture(directory('../_shared/_fixtures/app/'));\n",
            'specs/cli/create.spec.ts': `test('creates', async () => {\n    await api.request(\`\n${lines(31).trimEnd().replaceAll(/^/gmu, '        ')}\n    \`);\n});\n`,
            [SPEC]: [
                "import { file } from '@jterrazz/test';",
                '',
                "describe('users', () => {",
                "    test('pages users', async () => {",
                "        await expect(result.body).toMatch(file('./_expected/deep/pages.txt'));",
                '    });',
                "    test('lists users', async () => {",
                "        await expect(result.body).toMatch(file('./_expected/users.txt'));",
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
            existsSync(join(root, 'specs/api/_expected')),
        ]).toStrictEqual([
            [
                'wrote specs/cli/create.spec.ts:2 → specs/cli/_requests/creates.http',
                'inlined specs/api/_expected/users.txt → specs/api/users.spec.ts:8',
                'inlined specs/api/_expected/deep/pages.txt → specs/api/users.spec.ts:5',
                'moved specs/_shared/_fixtures/app → specs/cli/_fixtures/app',
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
            'specs/api/_expected/shared.txt': 's\n',
            'specs/api/_expected/users.txt': 'u\n',
            'specs/api/_requests/seed.http': 'GET /\n',
            [SPEC]: [
                "import { file } from '@jterrazz/test';",
                testReading("file('./_expected/users.txt')"),
                testReading("file('./_expected/shared.txt')", 'a'),
                testReading("file('./_expected/shared.txt')", 'b'),
                "test('seeds', () => api.fixture(file('./_requests/seed.http')));",
                '',
            ].join('\n'),
        });

        // When - the fixer runs
        const done = fixGroundSharedOrInline(root);

        // Then - only the users file is inlined, and what still reads a file is kept
        expect([
            done,
            readFileSync(join(root, SPEC), 'utf8').split('\n')[0],
            existsSync(join(root, 'specs/api/_expected/shared.txt')),
            existsSync(join(root, 'specs/api/_requests/seed.http')),
        ]).toStrictEqual([
            ['inlined specs/api/_expected/users.txt → specs/api/users.spec.ts:3'],
            "import { file } from '@jterrazz/test';",
            true,
            true,
        ]);
    });
});
