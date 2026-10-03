import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../testing/package-tree.fixtures.js';
import {
    pathFrom,
    quotedLiterals,
    relativeLiterals,
    repointDocument,
    repointed,
    repointModuleTests,
    repointSource,
} from './repoint.js';

const moveSharedA = (path: string): string | undefined =>
    path === '../_shared/_fixtures/a/' ? './_fixtures/a/' : undefined;

const OWN_FIXTURE =
    'description: reads its own\nfixture: ./_fixtures/own/\nruns:\n    - command: echo\n      exit: 0\n';

const MOVE = { copy: '/m/specs/_shared/_fixtures/app', target: '/m/specs/api/_fixtures/app' };

describe('repoint', () => {
    test.each([
        ['../_shared/_fixtures/app', './_fixtures/app'],
        ['../_shared/_fixtures/app/', './_fixtures/app/'],
        ['../_shared/_fixtures/app/index.txt', './_fixtures/app/index.txt'],
        ['../_shared/_fixtures/other', undefined],
        ['../_shared/_fixtures/app-two', undefined],
    ])('the path %j read from specs/api names %j once the entry moved', (path, moved) => {
        // Given - the pool entry moved beside specs/api
        // Then - a path into it follows it, keeping a trailing slash; any other path is not moved
        expect(repointed('/m/specs/api', path, MOVE)).toBe(moved);
    });

    test('a path from a folder climbs or descends, and a descent, into a dot folder too, states its dot', () => {
        // Given - a target above, and one below
        // Then - the climb is as relative() writes it, the descent opens on ./
        expect([
            pathFrom('/m/a/b', '/m/c'),
            pathFrom('/m/a', '/m/a/b/c'),
            pathFrom('/m/a', '/m'),
            pathFrom('/m', '/m/.cache/x'),
        ]).toStrictEqual(['../../c', './b/c', '..', './.cache/x']);
    });

    test('the literals read are the quoted ones, whole, and only relative ones name a path', () => {
        // Given - quoted literals of each kind, a template with a hole, a regex and a comment
        const text = [
            'const a = \'./a\'; const b = "../b"; const c = `./c`;',
            ['const d = `./d/$', '{x}`;'].join(''),
            String.raw`const e = 'bare/e'; const f = /\.\/f/u; // './g'`,
        ].join('\n');

        // Then - every quoted literal without a hole, and among them the relative paths
        expect([
            quotedLiterals(text).map(({ value }) => value),
            relativeLiterals(text).map(({ value }) => value),
        ]).toStrictEqual([
            ['./a', '../b', './c', 'bare/e'],
            ['./a', '../b', './c'],
        ]);
    });

    test('a source has each moved literal rewritten in place, and the rest kept byte for byte', () => {
        // Given - a module naming the entry twice, another path once, and a bare literal
        const root = packageWith({
            'specs/api/helper.ts':
                "read('../_shared/a'); read('./kept'); read('../_shared/a/x', 'bare/y');\n",
        });

        // Then - each reach into the entry is rewritten, nothing else
        expect(
            repointSource(join(root, 'specs/api/helper.ts'), (path) =>
                path.startsWith('../_shared/a')
                    ? path.replace('../_shared/a', './_fixtures/a')
                    : undefined,
            ),
        ).toBe("read('./_fixtures/a'); read('./kept'); read('./_fixtures/a/x', 'bare/y');\n");
    });

    test('a spec document has each moved fixture rewritten on its line, and an unreadable one is kept', () => {
        // Given - a document naming a moved fixture, one that does not parse, and one naming its own
        const root = packageWith({
            'specs/api/a.spec.yaml':
                'description: reads\nfixture: ../_shared/_fixtures/a/\nruns:\n    - command: echo\n      exit: 0\n',
            'specs/api/b.spec.yaml': 'fixture: ../_shared/_fixtures/a/\n',
            'specs/api/c.spec.yaml': OWN_FIXTURE,
        });

        // Then - the fixture line follows the move; the broken and the unmoved documents are returned as they are
        expect([
            repointDocument(join(root, 'specs/api/a.spec.yaml'), moveSharedA),
            repointDocument(join(root, 'specs/api/b.spec.yaml'), moveSharedA),
            repointDocument(join(root, 'specs/api/c.spec.yaml'), moveSharedA),
        ]).toStrictEqual([
            'description: reads\nfixture: ./_fixtures/a/\nruns:\n    - command: echo\n      exit: 0\n',
            'fixture: ../_shared/_fixtures/a/\n',
            OWN_FIXTURE,
        ]);
    });

    test('the module tests that name a moved entry are rewritten and listed, the others are left', () => {
        // Given - one module test reaching into the pool entry, and one that does not
        const root = packageWith({
            'src/a.test.ts': "read('../specs/_shared/_fixtures/app/index.txt');\n",
            'src/b.test.ts': "read('./b.json');\n",
        });
        const specsRoot = join(root, 'specs');

        // When - the entry moved beside specs/api, with another entry moved first
        const rewritten = repointModuleTests(specsRoot, [
            {
                copy: join(specsRoot, '_shared/_fixtures/other'),
                target: join(specsRoot, 'cli/_fixtures/other'),
            },
            {
                copy: join(specsRoot, '_shared/_fixtures/app'),
                target: join(specsRoot, 'api/_fixtures/app'),
            },
        ]);

        // Then - only the first is listed, and it names the new place
        expect([rewritten, readFileSync(join(root, 'src/a.test.ts'), 'utf8')]).toStrictEqual([
            [join(root, 'src/a.test.ts')],
            "read('../specs/api/_fixtures/app/index.txt');\n",
        ]);
    });
});
