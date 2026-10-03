import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../testing/package-tree.fixtures.js';
import {
    byPosition,
    facetOf,
    finding,
    isProduction,
    listed,
    productionReferences,
    targetOf,
} from './source.js';

describe('source', () => {
    test('listed — every entry below a folder, folders marked, and nothing of a folder that is not there', () => {
        // Given - a nested tree
        const root = packageWith({ 'src/a.ts': '', 'src/deep/b.ts': '' });

        // Then - each entry under its written root, and none of a missing one
        expect([
            listed(join(root, 'src'), 'src'),
            listed(join(root, 'lint'), 'lint'),
        ]).toStrictEqual([
            [
                { directory: false, path: 'src/a.ts' },
                { directory: true, path: 'src/deep' },
                { directory: false, path: 'src/deep/b.ts' },
            ],
            [],
        ]);
    });

    test('facetOf and isProduction — the facet a source sits in, and the sources that ship', () => {
        // Given - paths in and out of a facet, and modules of each kind
        // Then - each answer
        expect([
            [
                'src/facets/api/route.ts',
                'src/facets/api',
                'lint/facets/api/a.ts',
                'src/other/api/a.ts',
            ].map((path) => facetOf(path)),
            [
                'src/a.ts',
                'src/a.tsx',
                'src/a.test.ts',
                'src/a.test-d.ts',
                'src/a.fixtures.ts',
                'src/_expected/a.ts',
                'src/a.js',
                'src/a.ts.map',
            ].map((path) => isProduction(path)),
        ]).toStrictEqual([
            ['api', undefined, undefined, undefined],
            [true, true, false, false, false, false, false, false],
        ]);
    });

    test('finding and byPosition — a finding at the top unless placed, sorted by path, line and column', () => {
        // Given - findings placed and not, out of order
        const teaching = { fix: 'f', found: 'x' };
        const findings = [
            finding('rule', 'b.ts', teaching),
            finding('rule', 'a.ts', teaching, { column: 5, line: 2 }),
            finding('rule', 'a.ts', teaching, { column: 3, line: 2 }),
            finding('rule', 'a.ts', teaching, { column: 9, line: 1 }),
        ];

        // Then - in reading order
        expect(
            findings
                .toSorted(byPosition)
                .map(({ column, line, path }) => `${path}:${line}:${column}`),
        ).toStrictEqual(['a.ts:1:9', 'a.ts:2:3', 'a.ts:2:5', 'b.ts:1:1']);
        const later = finding('rule', 'a.ts', teaching, { column: 5, line: 2 });
        const earlier = finding('rule', 'a.ts', teaching, { column: 3, line: 2 });
        const unplaced = { ...teaching, line: 1, path: 'a.ts', rule: 'rule' };
        expect([
            Math.sign(byPosition(later, earlier)),
            Math.sign(byPosition(unplaced, { ...unplaced, column: 2 })),
        ]).toStrictEqual([1, -1]);
    });

    test('productionReferences and targetOf — each specifier a shipped module imports, at its place, read to the source it names', () => {
        // Given - modules importing statically, re-exporting, importing dynamically, a test, and one that does not parse
        const root = packageWith({
            'lint/rule.ts': "export { x } from '../src/a.js';\n",
            'src/a.test.ts': "import { b } from './b.js';\n",
            'src/a.ts':
                "import { b } from './b.js';\nconst c = 1;\nconst d = await import('./deep/d.js');\nexport * from './e.js';\n",
            'src/broken.ts': 'const = ;\n',
            'src/deep/d.ts': "import type { A } from '../a.js';\n",
        });

        // Then - each reference, then what its specifier names
        const references = productionReferences(root);
        expect([
            references.map(
                ({ from, reference }) =>
                    `${from}:${reference.line}:${reference.column} ${reference.specifier}`,
            ),
            references.map(({ from, reference }) => targetOf(from, reference.specifier)),
        ]).toStrictEqual([
            [
                'src/a.ts:1:1 ./b.js',
                'src/a.ts:4:1 ./e.js',
                'src/a.ts:3:17 ./deep/d.js',
                'src/deep/d.ts:1:1 ../a.js',
                'lint/rule.ts:1:1 ../src/a.js',
            ],
            ['src/b.ts', 'src/e.ts', 'src/deep/d.ts', 'src/a.ts', 'src/a.ts'],
        ]);
        expect(targetOf('src/a.ts', './data.json')).toBe('src/data.json');
    });
});
