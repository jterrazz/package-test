#!/usr/bin/env node
import { exitCodeOf, projected, writeProjections } from '@jterrazz/typescript/rules';
import type { Projection } from '@jterrazz/typescript/rules';
import { resolve } from 'node:path';

import { CATALOGUE_CHAPTER, CATALOGUE_MARKERS } from '../consumer/catalogue/chapter.js';
import { FAMILIES } from '../consumer/catalogue/families.js';
import { FORK_CHAPTER, FORK_MARKERS, forkTable } from '../consumer/catalogue/fork.js';
import { consumerRows } from '../consumer/catalogue/manifest.js';
import { catalogueBody } from '../engine/catalogue/chapter.js';
import { runAtZero } from '../engine/checker/at-zero.js';
import { runCoverageFloor } from '../engine/checker/coverage-run.js';
import { SELF_CHAPTER_MARKERS, selfChapterTable } from './catalogue/chapter.js';
import { SELF_CHAPTER } from './catalogue/manifest.js';
import { SELF_CHECKER } from './checks/checker.js';
import { checkCoverageFloor } from './checks/coverage-floor.js';
import {
    MATRIX_LAYERS_MARKERS,
    MATRIX_MARKERS,
    renderMatrixBody,
    renderMatrixLayers,
} from './corpus/matrix.js';
import { META_TESTS_MARKERS, renderMetaTests } from './corpus/meta-tests.js';
import { renderSiblings, SIBLINGS_MARKERS } from './corpus/siblings.js';

/* oxlint-disable eslint/no-console -- this file IS the CLI: its output is the product, and a reporter that wrote anywhere else would be reporting to nobody. */

/** Each page is named from the root it is regenerated under, so a projection writes where the run points. */
export function projectionsAt(root: string): Projection[] {
    const at = (page: string): string => resolve(root, page);

    return [
        {
            markers: CATALOGUE_MARKERS,
            page: at(CATALOGUE_CHAPTER),
            render: () => catalogueBody(consumerRows, FAMILIES),
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

function regenerate(cliArguments: readonly string[]): void {
    const root = resolve(cliArguments[0] ?? '.');
    writeProjections(projectionsAt(root));
    console.log(
        `chapters: regenerated ${[CATALOGUE_CHAPTER, SELF_CHAPTER, FORK_CHAPTER].join(', ')}`,
    );
    process.exit(0);
}

const COMMANDS: Record<string, (cliArguments: readonly string[]) => void> = {
    chapters: regenerate,
    check: (cliArguments) => runAtZero(SELF_CHECKER, cliArguments),
    coverage: (cliArguments) => runCoverageFloor(checkCoverageFloor, cliArguments),
};

if (import.meta.main) {
    const [name = '', ...rest] = process.argv.slice(2);
    const command = COMMANDS[name];
    if (command === undefined) {
        console.error(
            `self: no command named \`${name}\` — it runs ${Object.keys(COMMANDS).join(', ')}`,
        );
        process.exit(2);
    }
    process.exit(
        exitCodeOf(() => {
            command(rest);
        }),
    );
}
