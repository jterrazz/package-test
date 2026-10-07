import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../kit/testing/package-tree.fixtures.js';
import {
    checkInlineSeeds,
    commentName,
    fixInlineSeeds,
    titleName,
} from '../ground-shared-or-inline.seeds.js';

const SEEDED = [
    "import { sql } from '@jterrazz/test';",
    "test('lists the users', async () => {",
    '    await api.seed(sql`',
    '        -- two users',
    '        INSERT INTO users VALUES (1);',
    "    `).get('/users');",
    '});',
    "test('pages users', async () => { await api.seed(sql`INSERT INTO t VALUES (2);`).get('/x'); });",
    ["test('built', async () => { await api.seed(sql  `INSERT $", '{x}`); });'].join(''),
    '// checker-disable-next-line ground-shared-or-inline -- the statement is the case',
    "test('kept', async () => { await api.seed(sql  `INSERT INTO k VALUES (3);`); });",
    'const shown = "sql`not code`";',
    '',
].join('\n');

describe('ground-shared-or-inline.seeds', () => {
    test('ground-shared-or-inline.seeds — the seed branch of `ground-shared-or-inline` — a seed file is named by its first comment — the first -- comment names the file, whatever line it stands on', () => {
        // Given - statements opening on a comment, and statements with two further down
        // Then - the first comment, kebab-cased
        expect(commentName('-- Two users, one admin\nINSERT INTO users VALUES (1);')).toBe(
            'two-users-one-admin',
        );
        expect(commentName('INSERT INTO users VALUES (1);\n  -- the second\n-- the third')).toBe(
            'the-second',
        );
    });

    test('ground-shared-or-inline.seeds — the seed branch of `ground-shared-or-inline` — a seed file is named by its first comment — statements with no comment, or a comment of no word, name nothing', () => {
        // Given - statements with no comment, and a comment of dashes alone
        // Then - the caller falls back to the test's title
        expect(commentName("INSERT INTO users (name) VALUES ('Ada');")).toBeUndefined();
        expect(commentName('-- ---\nINSERT INTO users VALUES (1);')).toBeUndefined();
        expect([
            commentName('INSERT INTO t VALUES (1); -- inline note'),
            commentName('--note here'),
            commentName('-- note'),
        ]).toStrictEqual([undefined, 'note-here', 'note']);
    });

    test.each([
        [
            'seeds apply in the order listed, each to the database it names',
            'seeds-apply-order-listed',
        ],
        ['lists the users', 'lists-users'],
        ['A user with an admin role', 'user-admin-role'],
        ['the', undefined],
        ['!!!', undefined],
    ])(
        'ground-shared-or-inline.seeds — the seed branch of `ground-shared-or-inline` — a seed with no comment is named by its test — the title %j names the seed %j',
        (title, name) => {
            // Given - a test's title
            // Then - its first four meaningful words, kebab-cased, or nothing when it has none
            expect(titleName(title)).toBe(name);
        },
    );

    test('ground-shared-or-inline.seeds — the seed branch of `ground-shared-or-inline` — a sql template a test seeds with is named, unless built, silenced, quoted, or never imported', () => {
        // Given - a spec seeding from sql templates of each kind, and one that never imports sql
        const root = packageWith({
            'specs/api/other.spec.ts':
                "test('x', async () => { await api.seed(sql`INSERT INTO t VALUES (1);`); });\n",
            'specs/api/users/list.spec.ts': SEEDED,
        });

        // Then - each template the check names, with the file its fix writes
        expect(
            checkInlineSeeds(root).map(
                ({ column, fix, found, line, path }) =>
                    `${path}:${line}:${column} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            "specs/api/users/list.spec.ts:3:20 SQL written in the test, tagged `sql` — write the statements to ./__seeds__/two-users.sql and seed it with file('./__seeds__/two-users.sql') — `typescript fix` writes the file",
            "specs/api/users/list.spec.ts:8:50 SQL written in the test, tagged `sql` — write the statements to ./__seeds__/pages-users.sql and seed it with file('./__seeds__/pages-users.sql') — `typescript fix` writes the file",
            "specs/api/users/list.spec.ts:9:44 SQL written in the test, tagged `sql` — write the statements to ./__seeds__/built.sql and seed it with file('./__seeds__/built.sql') — `typescript fix` writes the file",
        ]);
    });

    test('ground-shared-or-inline.seeds — the seed branch of `ground-shared-or-inline` — the fix writes each literal seed to a file, names it in place, and keeps the import a built one still needs', () => {
        // Given - the same spec, beside a seed file of its first name holding other bytes, and one of its second holding its very statements
        const root = packageWith({
            'specs/api/users/__seeds__/pages-users.sql': 'INSERT INTO t VALUES (2);',
            'specs/api/users/__seeds__/two-users.sql': 'other bytes\n',
            'specs/api/users/list.spec.ts': SEEDED.replace('const shown = "sql`not code`";\n', ''),
        });

        // When - the fixer runs
        const done = fixInlineSeeds(root);

        // Then - two files written, the spec naming them, the sql import kept beside file
        const spec = readFileSync(join(root, 'specs/api/users/list.spec.ts'), 'utf8');
        expect([
            done,
            readFileSync(join(root, 'specs/api/users/__seeds__/two-users-2.sql'), 'utf8'),
            spec.split('\n')[0],
            spec.includes("api.seed(file('./__seeds__/pages-users.sql')).get('/x')"),
        ]).toStrictEqual([
            [
                'specs/api/users/list.spec.ts:8 → specs/api/users/__seeds__/pages-users.sql',
                'specs/api/users/list.spec.ts:3 → specs/api/users/__seeds__/two-users-2.sql',
            ],
            '-- two users\nINSERT INTO users VALUES (1);\n',
            "import { file, sql } from '@jterrazz/test';",
            true,
        ]);
    });
});
