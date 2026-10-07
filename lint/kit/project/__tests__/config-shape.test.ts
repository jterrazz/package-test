import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../testing/package-tree.fixtures.js';
import { isNode, nodeStart } from '../ast.js';
import type { AstNode } from '../ast.js';
import {
    collectedSegments,
    collectsAFile,
    includedGlobs,
    literateRunners,
    specificationOfSegments,
    staticPrefix,
} from '../config-shape.js';
import type { LiteralString } from '../config-shape.js';
import { parseProgram } from '../module-parser.js';

function programOf(source: string): AstNode {
    const program = parseProgram('vitest.config.ts', source);
    if (!isNode(program)) {
        throw new Error('the config fixture does not parse');
    }
    return program;
}

const located = ({ node, value }: LiteralString): string => `${value}@${nodeStart(node)}`;

describe('config-shape', () => {
    test('includedGlobs — the literal globs of a project under `test` or in `projects`, and of nothing else', () => {
        // Given - a test block, projects with and without an include, a shared one, and an include of package specifiers
        const source = [
            'export default {',
            "    optimizeDeps: { include: ['react'] },",
            "    plugins: [{ include: ['plugin/**'] }],",
            "    test: { include: ['specs/**/*.spec.ts', glob] },",
            '    projects: [',
            "        { name: 'unit', include: ['src/**/*.test.ts'] },",
            "        { name: label, include: 'specs/**' },",
            "        { name: 'bare' },",
            '        shared,',
            '    ],',
            '};',
        ].join('\n');

        // Then - each literal glob, where it is written
        expect(includedGlobs(programOf(source)).map(located)).toStrictEqual([
            'specs/**/*.spec.ts@124',
            'src/**/*.test.ts@205',
        ]);
    });

    test('includedGlobs — the literal globs of the projects `jterrazz.config.ts` keys by specification', () => {
        // Given - a test section declaring two projects, one of them with no include
        const source = [
            'export default {',
            '    test: {',
            '        projects: {',
            "            api: { include: ['specs/api/**/*.spec.ts'], reason: 'the api' },",
            "            unit: { reason: 'the modules' },",
            '        },',
            '    },',
            '};',
        ].join('\n');

        // Then - the one literal glob, where it is written
        expect(includedGlobs(programOf(source)).map(located)).toStrictEqual([
            'specs/api/**/*.spec.ts@78',
        ]);
    });

    test('literateRunners — the runner each `literate` block names, and none where it names no literal', () => {
        // Given - a literal runner, a computed one, a literate block that is no object, and an unrelated property
        const source = [
            'export default {',
            "    a: { literate: { runner: './specs/cli/cli.specification.ts' } },",
            '    b: { literate: { runner: path } },',
            '    c: { literate: true },',
            "    d: { runner: './elsewhere.ts' },",
            '};',
        ].join('\n');

        // Then - the one literal
        expect(literateRunners(programOf(source)).map(located)).toStrictEqual([
            './specs/cli/cli.specification.ts@38',
        ]);
    });

    test('staticPrefix — the folders before the first wildcard, or before the file when there is none', () => {
        // Given - globs wildcarded at each depth, by each wildcard character
        const globs = [
            'specs/api/**/*.spec.ts',
            'specs/api/users.spec.ts',
            'specs/?pi/x.ts',
            'specs/{api,cli}/x.ts',
            'specs/[ab]/x.ts',
            'specs/(a)/x.ts',
            'specs/!a/x.ts',
            '**/*.test.ts',
        ];

        // Then - each prefix
        expect(globs.map((glob) => staticPrefix(glob))).toStrictEqual([
            'specs/api',
            'specs/api',
            'specs',
            'specs',
            'specs',
            'specs',
            'specs',
            '',
        ]);
    });

    test('collectedSegments — the folders below specs/ a glob collects, read from the glob or from where the config sits', () => {
        // Given - a config at the root and one inside the specs tree
        const root = packageWith({
            'specs/api/users/vitest.config.ts': '',
            'vitest.config.ts': '',
        });
        const atRoot = join(root, 'vitest.config.ts');
        const inTree = join(root, 'specs/api/users/vitest.config.ts');

        // Then - the glob's own specs/ wins, a climb is unread, and a config in the tree adds its own folders
        expect([
            collectedSegments(atRoot, './specs/api/users/**/*.spec.ts'),
            collectedSegments(atRoot, 'other/specs/cli/*.spec.ts'),
            collectedSegments(atRoot, '../specs/api/*.spec.ts'),
            collectedSegments(atRoot, 'src/**/*.test.ts'),
            collectedSegments(inTree, 'listed/**/*.spec.ts'),
            collectedSegments(inTree, './listed/*.spec.ts'),
            collectedSegments(inTree, '*.spec.ts'),
        ]).toStrictEqual([
            ['api', 'users'],
            ['cli'],
            undefined,
            undefined,
            ['api', 'users', 'listed'],
            ['api', 'users', 'listed'],
            ['api', 'users'],
        ]);
    });

    test('specificationOfSegments — the first segment when it names a specification', () => {
        // Given - segments opening on a specification, on another folder, and none
        // Then - only the specification is read
        expect(
            [['api', 'users'], ['helpers'], [], undefined].map((segments) =>
                specificationOfSegments(segments),
            ),
        ).toStrictEqual(['api', undefined, undefined, undefined]);
    });

    test('collectsAFile — a glob collects a file when one below the folder matches it, past the folders a walk skips', () => {
        // Given - a tree with specs at several depths, and matches hidden in skipped folders
        const root = packageWith({
            'dist/a.spec.ts': '',
            'node_modules/x/b.spec.ts': '',
            'specs/api/deep/users.spec.ts': '',
            'specs/api/notes.md': '',
            'specs/cli/c.spec.ts': '',
        });

        // Then - each glob, against what is there
        expect(
            [
                'specs/**/*.spec.ts',
                'specs/*.spec.ts',
                'specs/api/*/users.spec.ts',
                'specs/api/deep/user?.spec.ts',
                'specs/{cli,job}/*.spec.ts',
                'specs/{job,mobile}/*.spec.ts',
                'specs/api/deep/users.spec.tsx',
                'specs/api/deep/users+spec.ts',
                '**/a.spec.ts',
                '**/b.spec.ts',
            ].map((glob) => collectsAFile(root, glob)),
        ).toStrictEqual([true, false, true, true, true, false, false, false, false, false]);
    });

    test('collectsAFile — the walk stops twelve folders down', () => {
        // Given - one spec twelve folders below the root, and one thirteen
        const twelve = Array.from({ length: 12 }, (_, at) => `d${at}`).join('/');
        const root = packageWith({ [`${twelve}/a.spec.ts`]: '', [`${twelve}/d12/b.spec.ts`]: '' });

        // Then - the first is found, the second is past the bound
        expect([
            collectsAFile(root, '**/a.spec.ts'),
            collectsAFile(root, '**/b.spec.ts'),
        ]).toStrictEqual([true, false]);
    });
});
