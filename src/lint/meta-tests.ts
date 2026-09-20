import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cell, table } from './catalog.js';

/**
 * The meta-test channel, read off the test files themselves.
 *
 * Several truths about this package cannot be asserted from outside it, so they
 * are asserted by running it on itself: the catalogue's freshness, the reach of
 * every rule, the capability matrix, the cards, the coverage floor. Chapter 03
 * owns the channel — and the table it published was written by hand, so it
 * named eight families while the channel had grown past a dozen files. A page
 * that lags the channel it owns is the defect this generator removes: the rows
 * come from the files, and a meta-test that lands is a row the next
 * `npm run docs` writes.
 *
 * What a row SAYS is the file's own top-level `describe` titles — the sentence
 * its author already wrote — rather than a second description kept beside them.
 */

/** One meta-test file: where it lives, what it declares, how many tests it runs. */
export type MetaTest = { file: string; holds: string[]; tests: number };

/**
 * Where the channel lives. `src/lint/*.test.ts` is the meta LAYER (the layered
 * reading counts it); `specs/lint/meta/` is the part that has to run the real
 * binary, so it sits with the end-to-end suite instead.
 */
const ROOTS = ['src/lint', 'specs/lint/meta'];

/** `*.test.ts` files directly inside `dir`, sorted, as repo-relative paths. */
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

/** The top-level `describe('…')` titles of a file, in source order. */
function describesOf(source: string): string[] {
    return [...source.matchAll(/^describe\(\s*(?<quote>['"`])(?<title>[^'"`]*)\k<quote>/gmu)].map(
        (hit) => hit.groups?.title ?? '',
    );
}

/**
 * How many tests a file DECLARES — `test('…')` and `test.each(…)('…')` alike.
 *
 * Anchored on the line's indentation, because `.test(` is also a regular
 * expression's own method and a count that swallowed four of those would be a
 * generated number nobody can reproduce by running the file.
 */
function testCountOf(source: string): number {
    return [...source.matchAll(/^[^\S\n]*test(?:\.each)?[\s(]/gmu)].length;
}

/** Every meta-test file, with what it declares. */
export function metaTests(root: string): MetaTest[] {
    return ROOTS.flatMap((relative) => testFilesIn(root, relative)).map((file) => {
        const source = readFileSync(resolve(root, file), 'utf8');
        return { file, holds: describesOf(source), tests: testCountOf(source) };
    });
}

export const META_TESTS_START =
    '<!-- GENERATED:meta-tests — do not edit by hand; run `npm run docs`. Source: src/lint/meta-tests.ts -->';
export const META_TESTS_END = '<!-- /GENERATED:meta-tests -->';

/** The meta-test table, generated: one row per file, its describes, its count. */
export function renderMetaTests(root: string): string {
    const rows = metaTests(root).map((entry) => [
        `\`${entry.file}\``,
        cell(entry.holds.join(' · ')),
        String(entry.tests),
    ]);
    const total = rows.length;
    return [
        `**${total} files** are the channel — every \`*.test.ts\` directly under \`src/lint/\`, plus the suite that needs the real binary. What each one holds is its own \`describe\` titles, read from the file:`,
        '',
        ...table(['Meta-test', 'Holds', 'Tests'], rows),
    ].join('\n');
}

/** Replace the region between the GENERATED:meta-tests markers of chapter 03. */
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
