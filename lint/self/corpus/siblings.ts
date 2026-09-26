import { join, resolve } from 'node:path';

import { cell, table } from '../../engine/catalogue/chapter.js';
import type { Markers } from '../../engine/catalogue/chapter.js';
import { treeEntries } from '../../engine/project/git-tree.js';
import { SIBLINGLESS_KINDS } from './siblingless-kinds.js';
import type { SiblinglessKind } from './siblingless-kinds.js';

/** Every siblingless module falls into one declared kind, each naming where its proof is; the first match wins, so the narrower kind is listed first. */

const CODE_ROOTS = ['src', 'lint'];

function listed(dir: string, at: string): string[] {
    const paths: string[] = [];
    for (const entry of treeEntries(dir)) {
        const path = `${at}/${entry.name}`;
        paths.push(path);
        if (entry.isDirectory()) {
            paths.push(...listed(join(dir, entry.name), path));
        }
    }
    return paths;
}

function codeFiles(root: string): string[] {
    return CODE_ROOTS.flatMap((tree) => listed(resolve(root, tree), tree));
}

function sources(root: string): string[] {
    return codeFiles(root).filter(
        (path) =>
            /\.tsx?$/u.test(path) &&
            !/\.(?:test|test-d|fixtures)\.tsx?$/u.test(path) &&
            !path.includes('/_fixtures/'),
    );
}

export function siblingless(root: string): string[] {
    const all = new Set(codeFiles(root));
    return sources(root)
        .filter((path) => !all.has(path.replace(/\.(?<extension>tsx?)$/u, '.test.$<extension>')))
        .toSorted();
}

export function classified(root: string): { kind: SiblinglessKind | undefined; path: string }[] {
    return siblingless(root).map((path) => ({
        kind: SIBLINGLESS_KINDS.find((candidate) => candidate.claims(path)),
        path,
    }));
}

export const SIBLINGS_MARKERS: Markers = {
    end: '<!-- /GENERATED:siblings -->',
    start: '<!-- GENERATED:siblings — do not edit by hand; run `npm run docs`. Source: lint/self/corpus/siblings.ts -->',
};

export function renderSiblings(root: string): string {
    const rows = classified(root);
    const total = rows.length;
    const body = SIBLINGLESS_KINDS.map((kind) => [
        cell(`${kind.name} (${rows.filter((row) => row.kind === kind).length})`),
        cell(kind.why),
    ]);
    return [
        `Today **${total} modules** have no sibling test, and every one of them is claimed:`,
        '',
        ...table(['Kind', 'Proven instead by'], body),
    ].join('\n');
}
