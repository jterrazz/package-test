import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { checkNoDuplicateGround, fixNoDuplicateGround } from '../no-duplicate-ground.js';

function foundIn(files: Record<string, string>): string[] {
    return checkNoDuplicateGround(packageWith(files)).map(
        ({ fix, found, line, path, rule }) => `${path}:${line} ${found} — ${fix} (${rule})`,
    );
}

const reader = (path: string): string => `api.fixture(directory('${path}'));\n`;

describe('no-duplicate-ground', () => {
    test('the same entry in the ground of two leaves is to keep once, in the folder they share', () => {
        // Given - one app tree and one golden copied into two leaves
        const found = foundIn({
            'specs/api/orders/__expected__/a.json': '{}\n',
            'specs/api/orders/__fixtures__/app/x.txt': 'x\n',
            'specs/api/users/__expected__/a.json': '{}\n',
            'specs/api/users/__fixtures__/app/x.txt': 'x\n',
        });

        // Then - each copy is named, beside the other
        expect(found).toStrictEqual([
            'specs/api/orders/__expected__/a.json:1 the same file as specs/api/users/__expected__/a.json — keep one copy in specs/api/__expected__/a.json — `typescript fix` moves it there and rewrites every whole relative path that named a copy (no-duplicate-ground)',
            'specs/api/users/__expected__/a.json:1 the same file as specs/api/orders/__expected__/a.json — keep one copy in specs/api/__expected__/a.json — `typescript fix` moves it there and rewrites every whole relative path that named a copy (no-duplicate-ground)',
            'specs/api/orders/__fixtures__/app:1 the same tree as specs/api/users/__fixtures__/app — keep one copy in specs/api/__fixtures__/app — `typescript fix` moves it there and rewrites every whole relative path that named a copy (no-duplicate-ground)',
            'specs/api/users/__fixtures__/app:1 the same tree as specs/api/orders/__fixtures__/app — keep one copy in specs/api/__fixtures__/app — `typescript fix` moves it there and rewrites every whole relative path that named a copy (no-duplicate-ground)',
        ]);
    });

    test.each([
        [
            'their contents differ',
            { 'specs/a/__fixtures__/x.txt': '1\n', 'specs/b/__fixtures__/x.txt': '2\n' },
        ],
        [
            'their roles differ',
            { 'specs/a/__fixtures__/x.sql': '1\n', 'specs/b/__seeds__/x.sql': '1\n' },
        ],
        [
            'one leaf holds both',
            { 'specs/a/__fixtures__/x.txt': '1\n', 'specs/a/__fixtures__/y.txt': '1\n' },
        ],
        [
            'their trees name their files apart',
            { 'specs/a/__fixtures__/app/x.txt': '1\n', 'specs/b/__fixtures__/app/y.txt': '1\n' },
        ],
        [
            'one sits in the ground at the specs root',
            { 'specs/__fixtures__/x.txt': '1\n', 'specs/b/__fixtures__/x.txt': '1\n' },
        ],
        [
            'a folder of that name holds a test',
            { 'specs/a/__fixtures__/x.spec.ts': '1\n', 'specs/b/__fixtures__/x.spec.ts': '1\n' },
        ],
    ])('no copy is reported when %s', (_, files) => {
        // Given - entries alike in some way only
        // Then - nothing
        expect(foundIn(files)).toStrictEqual([]);
    });

    test('copies of several names, or a target holding another entry, are the author to settle', () => {
        // Given - copies named apart, and copies whose shared place holds something else
        const named = checkNoDuplicateGround(
            packageWith({
                'specs/a/__fixtures__/x.txt': '1\n',
                'specs/b/__fixtures__/y.txt': '1\n',
            }),
        );
        const taken = checkNoDuplicateGround(
            packageWith({
                'specs/api/__fixtures__/x.txt': 'other\n',
                'specs/api/a/__fixtures__/x.txt': '1\n',
                'specs/api/b/__fixtures__/x.txt': '1\n',
            }),
        );

        // Then - the advice names what to do by hand
        expect([named.map(({ fix }) => fix), taken.map(({ fix }) => fix)]).toStrictEqual([
            [
                'give the copies the one name the entry should keep — they go by several, so `typescript fix` moves none',
                'give the copies the one name the entry should keep — they go by several, so `typescript fix` moves none',
            ],
            [
                'keep one copy in specs/api/__fixtures__/x.txt — it holds another x.txt, so rename one of the two first',
                'keep one copy in specs/api/__fixtures__/x.txt — it holds another x.txt, so rename one of the two first',
            ],
        ]);
    });

    test('the fix keeps one copy where its readers share, repoints them, and deletes the copies a held entry already matches', () => {
        // Given - an app copied into two leaves, read by a spec, a document and a module test, beside a ground already there, and a golden whose shared place already holds it, beside another
        const root = packageWith({
            'specs/api/__expected__/a.json': '{}\n',
            'specs/api/__fixtures__/kept.txt': 'k\n',
            'specs/api/orders/__expected__/a.json': '{}\n',
            'specs/api/orders/__expected__/other.json': '[]\n',
            'specs/api/orders/__fixtures__/app/x.txt': 'x\n',
            'specs/api/orders/list.spec.ts': reader('./__fixtures__/app/'),
            'specs/api/users/__expected__/a.json': '{}\n',
            'specs/api/users/__fixtures__/app/x.txt': 'x\n',
            'specs/api/users/list.spec.yaml':
                'description: lists\nfixture: ./__fixtures__/app/\nruns:\n    - command: echo\n      exit: 0\n',
            'src/orders.test.ts': "read('../specs/api/users/__fixtures__/app/x.txt');\n",
        });

        // When - the fixer runs
        const moved = fixNoDuplicateGround(root);

        // Then - one app under specs/api, every reader repointed, the golden copies gone and their grounds kept where they hold more
        expect([
            moved,
            readFileSync(join(root, 'specs/api/orders/list.spec.ts'), 'utf8'),
            readFileSync(join(root, 'specs/api/users/list.spec.yaml'), 'utf8'),
            readFileSync(join(root, 'src/orders.test.ts'), 'utf8'),
            existsSync(join(root, 'specs/api/__fixtures__/app/x.txt')),
            existsSync(join(root, 'specs/api/users/__fixtures__')),
            existsSync(join(root, 'specs/api/orders/__expected__/other.json')),
        ]).toStrictEqual([
            [
                'specs/api/orders/__expected__/a.json, specs/api/users/__expected__/a.json → specs/api/__expected__/a.json',
                'specs/api/orders/__fixtures__/app, specs/api/users/__fixtures__/app → specs/api/__fixtures__/app',
            ],
            reader('../__fixtures__/app/'),
            'description: lists\nfixture: ../__fixtures__/app/\nruns:\n    - command: echo\n      exit: 0\n',
            "read('../specs/api/__fixtures__/app/x.txt');\n",
            true,
            false,
            true,
        ]);
    });

    test('three copies each name the other two, a held copy alike is only to delete, and the fix leaves what it may not settle', () => {
        // Given - three copies, two whose shared place holds the same entry, and two groups the fix must leave
        const three = checkNoDuplicateGround(
            packageWith({
                'specs/a/__fixtures__/x.txt': '1\n',
                'specs/b/__fixtures__/x.txt': '1\n',
                'specs/c/__fixtures__/x.txt': '1\n',
            }),
        );
        const held = checkNoDuplicateGround(
            packageWith({
                'specs/api/__fixtures__/x.txt': '1\n',
                'specs/api/a/__fixtures__/x.txt': '1\n',
                'specs/api/b/__fixtures__/x.txt': '1\n',
            }),
        );
        const unsettled = [
            fixNoDuplicateGround(
                packageWith({
                    'specs/a/__fixtures__/x.txt': '1\n',
                    'specs/b/__fixtures__/y.txt': '1\n',
                }),
            ),
            fixNoDuplicateGround(
                packageWith({
                    'specs/api/__fixtures__/x.txt': 'other\n',
                    'specs/api/a/__fixtures__/x.txt': '1\n',
                    'specs/api/b/__fixtures__/x.txt': '1\n',
                }),
            ),
        ];

        // Then - the others listed, the plain advice for a held copy, and no move
        expect([three[0]?.found, held[0]?.fix, unsettled]).toStrictEqual([
            'the same file as specs/b/__fixtures__/x.txt, specs/c/__fixtures__/x.txt',
            'keep one copy in specs/api/__fixtures__/x.txt — `typescript fix` moves it there and rewrites every whole relative path that named a copy',
            [[], []],
        ]);
    });
});
