#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { FAMILIES } from '../consumer/catalogue/families.js';
import { FORK_MARKERS, forkTable } from '../consumer/catalogue/fork.js';
import { consumerRows } from '../consumer/catalogue/manifest.js';
import { catalogueBody, spliceBetween } from '../engine/catalogue/chapter.js';
import type { Markers } from '../engine/catalogue/chapter.js';
import { runAtZero } from '../engine/checker/at-zero.js';
import { runCoverageFloor } from '../engine/checker/coverage-run.js';
import { exitCodeOf } from '../engine/checker/stop.js';
import { SELF_CHAPTER_MARKERS, selfChapterTable } from './catalogue/chapter.js';
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

type Chapter = { markers: Markers; page: string; render: (root: string) => string };

const CATALOGUE_MARKERS: Markers = {
    end: '<!-- /GENERATED:catalogue -->',
    start: '<!-- GENERATED:catalogue — do not edit by hand; run `npm run docs`. Source: lint/consumer/catalogue/manifest.ts -->',
};

export const CHAPTERS: readonly Chapter[] = [
    {
        markers: CATALOGUE_MARKERS,
        page: 'docs/19-linting.md',
        render: () => catalogueBody(consumerRows, FAMILIES),
    },
    { markers: MATRIX_MARKERS, page: 'docs/03-testing.md', render: renderMatrixBody },
    { markers: MATRIX_LAYERS_MARKERS, page: 'docs/03-testing.md', render: renderMatrixLayers },
    { markers: SIBLINGS_MARKERS, page: 'docs/03-testing.md', render: renderSiblings },
    { markers: META_TESTS_MARKERS, page: 'docs/03-testing.md', render: renderMetaTests },
    { markers: SELF_CHAPTER_MARKERS, page: 'docs/03-testing.md', render: selfChapterTable },
    { markers: FORK_MARKERS, page: 'docs/18-conventions.md', render: () => forkTable().join('\n') },
];

export function chapterAt(root: string, page: string, existing: string): string {
    let text = existing;
    for (const { markers, render } of CHAPTERS.filter((chapter) => chapter.page === page)) {
        text = spliceBetween(text, markers, render(root), page);
    }
    return text;
}

function regenerate(cliArguments: readonly string[]): void {
    const root = resolve(cliArguments[0] ?? '.');
    for (const page of new Set(CHAPTERS.map((chapter) => chapter.page))) {
        const path = resolve(root, page);
        const existing = readFileSync(path, 'utf8');
        const next = chapterAt(root, page, existing);
        if (next !== existing) {
            writeFileSync(path, next);
        }
    }
    console.log(
        `chapters: regenerated ${[...new Set(CHAPTERS.map(({ page }) => page))].join(', ')}`,
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
