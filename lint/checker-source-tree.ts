import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { treeEntries } from '../src/kernel/files/git-tree.js';
import type { TokenViolation } from './checker.js';

/**
 * The shape of this package's `src/` tree — the self checker passes I9 and
 * I12, read off the tree git does not ignore: what its root holds, and what a
 * folder may be named and hold. What its modules import is I10's and I11's
 * (`checker-source-imports.ts`); the direction between the layers is I1's
 * (`self-layers.ts`), which a folder-level map cannot say this much about.
 *
 * Each pass takes a project root and reports paths relative to it; a root
 * with no `src/` holds nothing to judge.
 */

/** What `src/` holds at its root: the two entries, their test, the type channel, and the six trees. */
export const SOURCE_ROOT = [
    'elements',
    'expectations',
    'facets',
    'index.browser.ts',
    'index.test.ts',
    'index.ts',
    'kernel',
    'type-channel.test-d.ts',
    'vitest',
    'world',
];

/** The folders that are ground — what a test stands on — never a concept of the code. */
const GROUND = new Set(['expected', 'fixtures', 'requests', 'seeds']);

/** Folder names that say what a file IS rather than what it is about: a role rides on the file suffix. */
const ROLE_NAMES = new Set([
    'actions',
    'adapters',
    'capabilities',
    'common',
    'core',
    'helpers',
    'lib',
    'misc',
    'ports',
    'results',
    'shared',
    'types',
    'utils',
]);

/** A path of the tree, and whether it is a folder. */
export type Listed = { directory: boolean; path: string };

/** Every path under `dir` git does not ignore, `/`-separated and prefixed by `at`, folders included. */
export function listed(dir: string, at: string): Listed[] {
    if (!existsSync(dir)) {
        return [];
    }
    const paths: Listed[] = [];
    for (const entry of treeEntries(dir)) {
        const path = `${at}/${entry.name}`;
        paths.push({ directory: entry.isDirectory(), path });
        if (entry.isDirectory()) {
            paths.push(...listed(join(dir, entry.name), path));
        }
    }
    return paths;
}

/** Is the path ground, or below it? */
export function inGround(path: string): boolean {
    return path.split('/').some((segment) => GROUND.has(segment));
}

/** The facet a repository path sits in, when it sits in one. */
export function facetOf(path: string): string | undefined {
    const [source, tree, facet, below] = path.split('/');
    return source === 'src' && tree === 'facets' && below !== undefined ? facet : undefined;
}

/** Where a finding about a whole file or folder points: its first column. */
const AT_ITS_TOP = { column: 1, line: 1 };

/** A finding of a pass, at a path of the project. */
export function finding(
    rule: TokenViolation['rule'],
    file: string,
    teaching: Pick<TokenViolation, 'fix' | 'found'>,
    at: { column: number; line: number } = AT_ITS_TOP,
): TokenViolation {
    return { ...teaching, ...at, file, rule, severity: 'error' };
}

/** By path, then line, then column — the order a report reads in. */
export function byPosition(one: TokenViolation, other: TokenViolation): number {
    return (
        one.file.localeCompare(other.file) ||
        one.line - other.line ||
        (one.column ?? 1) - (other.column ?? 1)
    );
}

/** I9 — every entry `src/` holds at its root that it may not, at the entry. */
export function checkSourceRoot(root: string): TokenViolation[] {
    return listed(resolve(root, 'src'), 'src')
        .filter(({ path }) => path.split('/').length === 2)
        .filter(({ path }) => !SOURCE_ROOT.includes(path.slice('src/'.length)))
        .map(({ directory, path }) =>
            finding('i9-source-root', path, {
                fix: 'move it into the tree whose concept it is — what is tested (`facets/`), what surrounds it (`world/`), how a screen is touched (`elements/`), how a result is judged (`expectations/`), the machinery (`kernel/`) or the runner config (`vitest/`)',
                found: `the ${directory ? 'folder' : 'file'} \`${path}\` at the source root, which holds the two entries and the six trees alone`,
            }),
        )
        .toSorted(byPosition);
}

/**
 * I12 — what a folder of `src/` may be named and hold: never a role name; at
 * least two entries, a lone file sitting at its parent instead; and at a
 * facet's root with concept folders, its face alone — `index.ts`, the
 * component's `index.browser.ts`, `<facet>.facet.ts`, `<facet>.handle.ts`,
 * `<facet>.project.ts` and their tests. Ground is exempt: it is what a test
 * stands on. A folder's finding sits at the folder, a file's at the file.
 */
export function checkFolderShape(root: string): TokenViolation[] {
    const paths = listed(resolve(root, 'src'), 'src');
    const folders = paths.filter(({ directory, path }) => directory && !inGround(path));
    const childrenOf = (folder: string): Listed[] =>
        paths.filter(({ path }) => dirname(path) === folder);
    const found = folders.flatMap(({ path }) => {
        const name = path.split('/').at(-1) ?? '';
        const children = childrenOf(path);
        return [
            ...(ROLE_NAMES.has(name)
                ? [
                      finding('i12-folder-shape', path, {
                          fix: 'name the folder for what its files are about, and let each file carry its role on its suffix (`*.port.ts`, `*.adapter.ts`, `*.capability.ts` …)',
                          found: `the folder \`${name}/\` is named for a role, not a concept`,
                      }),
                  ]
                : []),
            ...(children.length < 2
                ? [
                      finding('i12-folder-shape', path, {
                          fix: 'fold what it holds into its parent, or give the concept the second file it groups',
                          found: `the folder \`${name}/\` holds ${children.length === 0 ? 'nothing' : 'one entry'}`,
                      }),
                  ]
                : []),
        ];
    });
    return [...found, ...strayFaceFiles(paths, folders)].toSorted(byPosition);
}

/** Every file at the root of a facet with concept folders that is no file of its face. */
function strayFaceFiles(paths: Listed[], folders: Listed[]): TokenViolation[] {
    const facets = folders.filter(
        ({ path }) => path.split('/').length === 3 && facetOf(`${path}/x`) !== undefined,
    );
    return facets.flatMap(({ path }) => {
        const facet = path.split('/').at(-1) ?? '';
        const children = paths.filter(({ path: entry }) => dirname(entry) === path);
        const flat = !children.some(({ directory, path: entry }) => directory && !inGround(entry));
        const face = new Set([
            'index.ts',
            ...(facet === 'component' ? ['index.browser.ts'] : []),
            `${facet}.facet.ts`,
            `${facet}.handle.ts`,
            `${facet}.project.ts`,
        ]);
        return flat
            ? []
            : children
                  .filter(({ directory }) => !directory)
                  .map(({ path: file }) => file)
                  .filter(
                      (file) =>
                          !face.has(
                              (file.split('/').at(-1) ?? '').replace(/\.test(?:-d)?\.ts$/u, '.ts'),
                          ),
                  )
                  .map((file) =>
                      finding('i12-folder-shape', file, {
                          fix: 'move it into the concept folder it belongs to; the root of a facet with concept folders holds its face alone — `index.ts`, `<facet>.facet.ts`, `<facet>.handle.ts`, `<facet>.project.ts`',
                          found: `\`${file.split('/').at(-1) ?? ''}\` sits at the root of the facet \`${facet}\`, and is no file of its face`,
                      }),
                  );
    });
}
