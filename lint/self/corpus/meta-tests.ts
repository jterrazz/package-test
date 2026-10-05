import { cell, markdownTable } from '@jterrazz/typescript/rules';
import type { Markers } from '@jterrazz/typescript/rules';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** A row says what the file's own top-level `describe` titles say, never a second description kept beside them. */

export type MetaTest = { file: string; holds: string[]; tests: number };

/** `specs/lint/meta/` runs the real linters, so it sits with the lint specification's specs. */
export const META_TESTS_LAYER_ROOTS = ['lint/self/catalogue', 'lint/self/corpus'];

const ROOTS = [...META_TESTS_LAYER_ROOTS, 'specs/lint/meta'];

function testFilesIn(root: string, relative: string): string[] {
    try {
        return readdirSync(resolve(root, relative), { withFileTypes: true })
            .filter((entry) => entry.isFile() && /\.(?:test|spec)\.ts$/u.test(entry.name))
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

export const META_TESTS_MARKERS: Markers = {
    end: '<!-- /GENERATED:meta-tests -->',
    start: '<!-- GENERATED:meta-tests — do not edit by hand; run `npm run docs`. Source: lint/self/corpus/meta-tests.ts -->',
};

export function renderMetaTests(root: string): string {
    const rows = metaTests(root).map((entry) => [
        `\`${entry.file}\``,
        cell(entry.holds.join(' · ')),
        String(entry.tests),
    ]);
    const total = rows.length;
    return [
        `**${total} files** are the channel — every \`*.test.ts\` directly under ${META_TESTS_LAYER_ROOTS.map((folder) => `\`${folder}/\``).join(' or ')}, plus the suite that needs the real binary. What each one holds is its own \`describe\` titles, read from the file:`,
        '',
        markdownTable(['Meta-test', 'Holds', 'Tests'], rows),
    ].join('\n');
}
