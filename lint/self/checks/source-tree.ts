import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { treeEntries } from '../../../src/kernel/files/git-tree.js';
import { GROUND_DIRS } from '../../../src/kernel/files/ground.js';
import type { TokenViolation } from '../../checks/checker.js';
import type { SelfPassId } from './checker.js';

/** Read off the tree git does not ignore; a root with no `src/` holds nothing to judge. */

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

const GROUND = new Set<string>(GROUND_DIRS);

/** A role rides on the file suffix, never on a folder name. */
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

export type Listed = { directory: boolean; path: string };

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

export function inGround(path: string): boolean {
    return path.split('/').some((segment) => GROUND.has(segment));
}

export function facetOf(path: string): string | undefined {
    const [source, tree, facet, below] = path.split('/');
    return source === 'src' && tree === 'facets' && below !== undefined ? facet : undefined;
}

const AT_ITS_TOP = { column: 1, line: 1 };

export function finding(
    rule: SelfPassId,
    file: string,
    teaching: Pick<TokenViolation, 'fix' | 'found'>,
    at: { column: number; line: number } = AT_ITS_TOP,
): TokenViolation<SelfPassId> {
    return { ...teaching, ...at, file, rule, severity: 'error' };
}

export function byPosition(one: TokenViolation<string>, other: TokenViolation<string>): number {
    return (
        one.file.localeCompare(other.file) ||
        one.line - other.line ||
        (one.column ?? 1) - (other.column ?? 1)
    );
}

export function checkSourceRoot(root: string): TokenViolation<SelfPassId>[] {
    return listed(resolve(root, 'src'), 'src')
        .filter(({ path }) => path.split('/').length === 2)
        .filter(({ path }) => !SOURCE_ROOT.includes(path.slice('src/'.length)))
        .map(({ directory, path }) =>
            finding('source-root-holds-known-entries', path, {
                fix: 'move it into the tree whose concept it is — what is tested (`facets/`), what surrounds it (`world/`), how a screen is touched (`elements/`), how a result is judged (`expectations/`), the machinery (`kernel/`) or the runner config (`vitest/`)',
                found: `the ${directory ? 'folder' : 'file'} \`${path}\` at the source root, which holds the two entries and the six trees alone`,
            }),
        )
        .toSorted(byPosition);
}

/** Ground is exempt: it is what a test stands on. */
export function checkFolderShape(root: string): TokenViolation<SelfPassId>[] {
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
                      finding('folder-named-for-a-concept', path, {
                          fix: 'name the folder for what its files are about, and let each file carry its role on its suffix (`*.port.ts`, `*.adapter.ts`, `*.capability.ts` …)',
                          found: `the folder \`${name}/\` is named for a role, not a concept`,
                      }),
                  ]
                : []),
            ...(children.length < 2
                ? [
                      finding('folder-named-for-a-concept', path, {
                          fix: 'fold what it holds into its parent, or give the concept the second file it groups',
                          found: `the folder \`${name}/\` holds ${children.length === 0 ? 'nothing' : 'one entry'}`,
                      }),
                  ]
                : []),
        ];
    });
    return [...found, ...strayFaceFiles(paths, folders)].toSorted(byPosition);
}

function strayFaceFiles(paths: Listed[], folders: Listed[]): TokenViolation<SelfPassId>[] {
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
                      finding('folder-named-for-a-concept', file, {
                          fix: 'move it into the concept folder it belongs to; the root of a facet with concept folders holds its face alone — `index.ts`, `<facet>.facet.ts`, `<facet>.handle.ts`, `<facet>.project.ts`',
                          found: `\`${file.split('/').at(-1) ?? ''}\` sits at the root of the facet \`${facet}\`, and is no file of its face`,
                      }),
                  );
    });
}
