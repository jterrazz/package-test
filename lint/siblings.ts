import { join, resolve } from 'node:path';

import { treeEntries } from '../src/kernel/files/git-tree.js';
import { cell, table } from './catalog.js';
import { SIBLINGLESS_KINDS } from './siblingless-kinds.js';
import type { SiblinglessKind } from './siblingless-kinds.js';

/**
 * The modules with no `<file>.test.ts` beside them, and what proves each one.
 *
 * I2 says a module test lives beside its module; it does not say every module
 * has one, and it cannot: a barrel executes nothing, a `*.port.ts` declares a
 * shape, and a facet's constructor is proven by the tree that constructs it.
 * The defect this module exists to stop is the OTHER kind of silence — a module
 * with real behaviour, no sibling test, and nobody able to say what covers it.
 *
 * So every siblingless module falls into one declared kind, each carrying the
 * one line that says where its proof is. A module that matches none of them
 * fails `siblings.test.ts`: write the test, or write the kind and defend it.
 *
 * The kinds are ORDERED — the first match wins — so a path two kinds could
 * claim is read by the narrower one, listed first.
 */

/** The two trees of the spine that hold code a module test sits beside. */
const CODE_ROOTS = ['src', 'lint'];

/** Every path of the tree under `dir` git does not ignore, `/`-separated and prefixed by `at`. */
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

/** Every file of the code trees, `/`-separated and relative to the root. */
function codeFiles(root: string): string[] {
    return CODE_ROOTS.flatMap((tree) => listed(resolve(root, tree), tree));
}

/** Every source module, `/`-separated and relative to the root. */
function sources(root: string): string[] {
    return codeFiles(root).filter(
        (path) =>
            /\.tsx?$/u.test(path) &&
            !/\.(?:test|test-d|fixtures)\.tsx?$/u.test(path) &&
            !path.includes('/fixtures/'),
    );
}

/** The modules with no `<file>.test.ts(x)` beside them. */
export function siblingless(root: string): string[] {
    const all = new Set(codeFiles(root));
    return sources(root)
        .filter((path) => !all.has(path.replace(/\.(?<extension>tsx?)$/u, '.test.$<extension>')))
        .toSorted();
}

/** Each siblingless module paired with the first kind that claims it. */
export function classified(root: string): { kind: SiblinglessKind | undefined; path: string }[] {
    return siblingless(root).map((path) => ({
        kind: SIBLINGLESS_KINDS.find((candidate) => candidate.claims(path)),
        path,
    }));
}

/** Markers delimiting the generated kind table inside `docs/03-testing.md`. */
export const SIBLINGS_START =
    '<!-- GENERATED:siblings — do not edit by hand; run `npm run docs`. Source: lint/siblings.ts -->';
export const SIBLINGS_END = '<!-- /GENERATED:siblings -->';

/** The kind table, generated: one row per kind, with today's count and its reason. */
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

/** Replace the region between the GENERATED:siblings markers of chapter 03. */
export function spliceSiblings(existing: string, root: string): string {
    const start = existing.indexOf(SIBLINGS_START);
    const end = existing.indexOf(SIBLINGS_END);
    if (start === -1 || end === -1) {
        throw new Error(
            `docs/03-testing.md is missing the GENERATED:siblings markers (${SIBLINGS_START} … ${SIBLINGS_END})`,
        );
    }
    return `${existing.slice(0, start) + SIBLINGS_START}\n\n${renderSiblings(root)}\n\n${existing.slice(end)}`;
}
