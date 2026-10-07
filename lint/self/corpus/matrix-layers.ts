import { cell, markdownTable } from '@jterrazz/typescript/rules';
import type { Markers } from '@jterrazz/typescript/rules';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { sourcesUnder } from '../../kit/project/tree.js';
import { MATRIX_SOURCES_TREES } from './matrix-sources.js';
import { META_TESTS_LAYER_ROOTS } from './meta-tests.js';
import { SPECIFICATION_MATRIX_COLUMNS } from './specification-matrix.js';

export const MATRIX_LAYERS_MARKERS: Markers = {
    end: '<!-- /GENERATED:layers -->',
    start: '<!-- GENERATED:layers — do not edit by hand; run `npm run docs`. Source: lint/self/corpus/matrix.ts -->',
};

type Layer = { count: number; judges: string; layer: string; where: string };

function countUnder(root: string, roots: string[], extensions: string[]): number {
    return roots.flatMap((relative) => sourcesUnder(resolve(root, relative), extensions)).length;
}

function filesDirectlyIn(dir: string, extensions: string[]): number {
    try {
        return readdirSync(dir, { withFileTypes: true }).filter(
            (entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)),
        ).length;
    } catch {
        return 0;
    }
}

/** Innermost first, the order a reader reads them in. */
export function layers(root: string): Layer[] {
    const allModuleTests = countUnder(root, ['src'], ['.test.ts', '.test.tsx']);
    const ruleTests = countUnder(root, ['lint/consumer/rules'], ['.test.ts']);
    const metaTests = META_TESTS_LAYER_ROOTS.reduce(
        (total, tree) => total + filesDirectlyIn(resolve(root, tree), ['.test.ts']),
        0,
    );
    // invariant: a `*.specification.ts` builds a runner and asserts nothing.
    const specificationSpecs = SPECIFICATION_MATRIX_COLUMNS.filter(
        (column) => column !== 'module' && column !== 'lint',
    ).reduce(
        (total, column) =>
            total +
            countUnder(
                root,
                MATRIX_SOURCES_TREES[column].roots,
                MATRIX_SOURCES_TREES[column].extensions.filter(
                    (extension) => extension !== '.specification.ts',
                ),
            ),
        0,
    );
    const lintSpecs = countUnder(root, ['specs/lint'], ['.spec.ts']);
    return [
        {
            count: allModuleTests,
            judges: 'one module, through its own exports, with nothing started',
            layer: 'Module tests',
            where: '`src/**/__tests__/*.test.ts`, in the folder of the module',
        },
        {
            count: ruleTests,
            judges: 'one rule: what it flags, what it leaves alone, and the message it prints',
            layer: 'Rule tests',
            where: '`lint/consumer/rules/<family>/__tests__/<rule>.test.ts`, in the folder of the rule',
        },
        {
            count: specificationSpecs,
            judges: "the framework's own specifications, each met through its constructor",
            layer: 'The package’s own specs',
            where: '`specs/<specification>/`',
        },
        {
            count: lintSpecs,
            judges: 'the built plugins, checkers and preset end to end, over fixture trees',
            layer: 'The lint specs',
            where: '`specs/lint/<rule>/`, on the lint specification',
        },
        {
            count: metaTests,
            judges: 'the corpus itself: the catalogue, the matrix, the skill, the floor',
            layer: 'Meta-tests',
            where: META_TESTS_LAYER_ROOTS.map((folder) => `\`${folder}/*.test.ts\``).join(', '),
        },
    ];
}

export function renderMatrixLayers(root: string): string {
    const rows = layers(root).map((layer) => [
        layer.layer,
        cell(layer.where),
        cell(layer.judges),
        String(layer.count),
    ]);
    return markdownTable(['Layer', 'Where', 'What it judges', 'Files'], rows);
}
