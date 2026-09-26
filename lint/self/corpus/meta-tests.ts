import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cell, table } from '../../engine/catalogue/chapter.js';

/** A row says what the file's own top-level `describe` titles say, never a second description kept beside them. */

export type MetaTest = { file: string; holds: string[]; tests: number };

/** `specs/lint/meta/` runs the real binary, so it sits with the end-to-end suite. */
export const META_LAYER_ROOTS = ['lint/self/catalogue', 'lint/self/corpus'];

const ROOTS = [...META_LAYER_ROOTS, 'specs/lint/meta'];

function testFilesIn(root: string, relative: string): string[] {
    try {
        return readdirSync(resolve(root, relative), { withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
            .map((entry) => `${relative}/${entry.name}`)
            .toSorted();
    } catch {
        return [];
    }
}

function describesOf(source: string): string[] {
    return [...source.matchAll(/^describe\(\s*(?<quote>['"`])(?<title>[^'"`]*)\k<quote>/gmu)].map(
        (hit) => hit.groups?.title ?? '',
    );
}

/** Anchored on the line's indentation: `.test(` is also a regular expression's method. */
function testCountOf(source: string): number {
    return [...source.matchAll(/^[^\S\n]*test(?:\.each)?[\s(]/gmu)].length;
}

export function metaTests(root: string): MetaTest[] {
    return ROOTS.flatMap((relative) => testFilesIn(root, relative)).map((file) => {
        const source = readFileSync(resolve(root, file), 'utf8');
        return { file, holds: describesOf(source), tests: testCountOf(source) };
    });
}

export const META_TESTS_START =
    '<!-- GENERATED:meta-tests — do not edit by hand; run `npm run docs`. Source: lint/self/corpus/meta-tests.ts -->';
export const META_TESTS_END = '<!-- /GENERATED:meta-tests -->';

export function renderMetaTests(root: string): string {
    const rows = metaTests(root).map((entry) => [
        `\`${entry.file}\``,
        cell(entry.holds.join(' · ')),
        String(entry.tests),
    ]);
    const total = rows.length;
    return [
        `**${total} files** are the channel — every \`*.test.ts\` directly under ${META_LAYER_ROOTS.map((folder) => `\`${folder}/\``).join(' or ')}, plus the suite that needs the real binary. What each one holds is its own \`describe\` titles, read from the file:`,
        '',
        ...table(['Meta-test', 'Holds', 'Tests'], rows),
    ].join('\n');
}

export function spliceMetaTests(existing: string, root: string): string {
    const start = existing.indexOf(META_TESTS_START);
    const end = existing.indexOf(META_TESTS_END);
    if (start === -1 || end === -1) {
        throw new Error(
            `docs/03-testing.md is missing the GENERATED:meta-tests markers (${META_TESTS_START} … ${META_TESTS_END})`,
        );
    }
    const inner = `${META_TESTS_START}\n\n${renderMetaTests(root)}\n\n`;
    return existing.slice(0, start) + inner + existing.slice(end);
}
