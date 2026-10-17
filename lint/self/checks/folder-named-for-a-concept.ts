import { dirname, resolve } from 'node:path';

import type { Spotted } from '../../kit/checker/registry.js';
import {
    byPosition,
    finding,
    inGround,
    inTestsFolder,
    listed,
    specificationOf,
} from '../../kit/project/source.js';
import type { Listed } from '../../kit/project/source.js';
import type { SelfPassId } from './checker.js';

// invariant: a role rides on the file suffix, never on a folder name.
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

// outside: `@jterrazz/typescript` names the folder of a package's standard, whatever it holds.
const TOOLCHAIN_FOLDERS: ReadonlySet<string> = new Set(['src/standard']);

/** Ground and a tests folder are exempt: what a test stands on, and where it sits. */
export function checkFolderNamedForAConcept(root: string): Spotted<SelfPassId>[] {
    const paths = listed(resolve(root, 'src'), 'src');
    const folders = paths.filter(
        ({ directory, path }) => directory && !inGround(path) && !inTestsFolder(path),
    );
    const childrenOf = (folder: string): Listed[] =>
        paths.filter(({ path }) => dirname(path) === folder);
    const found = folders.flatMap(({ path }) => {
        const name = path.split('/').at(-1) ?? '';
        const children = childrenOf(path);
        return [
            ...(ROLE_NAMES.has(name)
                ? [
                      finding('folder-named-for-a-concept', path, {
                          fix: 'name the folder for what its files are about, and let each file carry its role on its suffix (`*.port.ts`, `*.adapter.ts`, `*.capability.ts` and the like)',
                          found: `the folder \`${name}/\` is named for a role, not a concept`,
                      }),
                  ]
                : []),
            ...(children.length < 2 && !TOOLCHAIN_FOLDERS.has(path)
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
    const specifications = folders.filter(
        ({ path }) => path.split('/').length === 3 && specificationOf(`${path}/x`) !== undefined,
    );
    return specifications.flatMap(({ path }) => {
        const specification = path.split('/').at(-1) ?? '';
        const children = paths.filter(({ path: entry }) => dirname(entry) === path);
        const flat = !children.some(
            ({ directory, path: entry }) => directory && !inGround(entry) && !inTestsFolder(entry),
        );
        const face = new Set([
            `${specification}.face.ts`,
            ...(specification === 'component' ? ['component.face.browser.ts'] : []),
            `${specification}.composition.ts`,
            `${specification}.handle.ts`,
            `${specification}.project.ts`,
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
                          fix: 'move it into the concept folder it belongs to; the root of a specification with concept folders holds its face alone: `<specification>.face.ts`, `<specification>.composition.ts`, `<specification>.handle.ts`, `<specification>.project.ts`',
                          found: `\`${file.split('/').at(-1) ?? ''}\` sits at the root of the specification \`${specification}\`, and is no file of its face`,
                      }),
                  );
    });
}
