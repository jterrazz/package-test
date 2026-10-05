#!/usr/bin/env node
import { projected, runChecker, writeProjections } from '@jterrazz/typescript/rules';
import type { Contribution, Projection } from '@jterrazz/typescript/rules';
import { resolve } from 'node:path';

import { RUNTIME_RULES } from '../../src/chain/refusals/rows.js';
import { CATALOGUE_MARKERS } from '../consumer/catalogue/chapter.js';
import { FAMILIES } from '../consumer/catalogue/families.js';
import { FORK_CHAPTER, FORK_MARKERS, forkTable } from '../consumer/catalogue/fork.js';
import { consumerRows } from '../consumer/catalogue/manifest.js';
import { CATALOGUE_CHAPTER, catalogueBody } from '../kit/catalogue/chapter.js';
import { atZeroPass } from '../kit/checker/at-zero-pass.js';
import { SELF_CHAPTER_MARKERS, selfChapterTable } from './catalogue/chapter.js';
import { SELF_CHAPTER } from './catalogue/manifest.js';
import { SELF_CHECKER } from './checks/checker.js';
import { MATRIX_LAYERS_MARKERS, renderMatrixLayers } from './corpus/matrix-layers.js';
import { MATRIX_MARKERS, renderMatrixBody } from './corpus/matrix.js';
import { META_TESTS_MARKERS, renderMetaTests } from './corpus/meta-tests.js';
import { renderSiblings, SIBLINGS_MARKERS } from './corpus/siblings.js';

/** Each page is named from the root it is regenerated under, so a projection writes where the run points. */
export function projectionsAt(root: string): Projection[] {
    const at = (page: string): string => resolve(root, page);

    return [
        {
            markers: CATALOGUE_MARKERS,
            page: at(CATALOGUE_CHAPTER),
            render: () => catalogueBody([...consumerRows, ...RUNTIME_RULES], FAMILIES),
        },
        { markers: MATRIX_MARKERS, page: at(SELF_CHAPTER), render: () => renderMatrixBody(root) },
        {
            markers: MATRIX_LAYERS_MARKERS,
            page: at(SELF_CHAPTER),
            render: () => renderMatrixLayers(root),
        },
        { markers: SIBLINGS_MARKERS, page: at(SELF_CHAPTER), render: () => renderSiblings(root) },
        {
            markers: META_TESTS_MARKERS,
            page: at(SELF_CHAPTER),
            render: () => renderMetaTests(root),
        },
        {
            markers: SELF_CHAPTER_MARKERS,
            page: at(SELF_CHAPTER),
            render: () => selfChapterTable(),
        },
        { markers: FORK_MARKERS, page: at(FORK_CHAPTER), render: () => forkTable() },
    ];
}

export function chapterAt(root: string, page: string, existing: string): string {
    return projected(existing, resolve(root, page), projectionsAt(root));
}

function regenerate(cliArguments: readonly string[]): number {
    const root = resolve(cliArguments[0] ?? '.');
    writeProjections(projectionsAt(root));
    process.stdout.write(
        `chapters: regenerated ${[CATALOGUE_CHAPTER, SELF_CHAPTER, FORK_CHAPTER].join(', ')}\n`,
    );

    return 0;
}

const selfChecks: Contribution = {
    commands: {
        chapters: async () => regenerate,
    },
    passes: { check: async () => atZeroPass(SELF_CHECKER) },
};

export default selfChecks;

if (import.meta.main) {
    await runChecker(selfChecks);
}
