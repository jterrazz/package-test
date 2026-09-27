import { dirname, resolve } from 'node:path';

import type { Spotted } from '../../engine/checker/registry.js';
import { byPosition, facetOf, finding, inGround, listed } from '../../engine/project/source.js';
import type { Listed } from '../../engine/project/source.js';
import type { SelfPassId } from './checker.js';

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

/** Ground is exempt: it is what a test stands on. */
export function checkFolderNamedForAConcept(root: string): Spotted<SelfPassId>[] {
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

function strayFaceFiles(paths: Listed[], folders: Listed[]): Spotted<SelfPassId>[] {
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
