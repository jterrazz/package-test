import { readFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';

import { treeEntries } from '../src/kernel/files/git-tree.js';
import { child, childList, isNode, stringValue, walk } from './ast.js';
import { parseProgram } from './module-parser.js';

/**
 * The shape of this package's `src/` tree, read off the tree git does not
 * ignore: what its root holds, what a facet may reach of another, which slice
 * imports each engine, and what a folder may be named and hold. The
 * meta-tests I9 to I12 hold it (`tree.test.ts`); the direction between the
 * layers is I1's (`self-layers.ts`), which a folder-level map cannot say this
 * much about.
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
const GROUND = new Set(['expected', 'fixtures', 'requests', 'seeds', 'shared']);

/** Folder names that say what a file IS rather than what it is about: a role rides on the file suffix. */
const ROLE_NAMES = new Set([
    'actions',
    'adapters',
    'capabilities',
    'common',
    'helpers',
    'lib',
    'ports',
    'results',
    'types',
    'utils',
]);

/**
 * The modules reached inside a facet from outside it, each for its reason: the
 * one vite plugin a facet owns (the cli's literate door, which the preset
 * wires), and the two modules the checker reads with the runner (the route
 * ratchet's key, the `.spec.yaml` grammar).
 */
const REACHED_INSIDE_A_FACET = new Set([
    'src/facets/api/routes/routes.ts',
    'src/facets/cli/documents/literate-plugin.ts',
    'src/facets/cli/documents/spec-document.ts',
]);

/**
 * The one slice each third-party engine is imported from, by the specifier's
 * prefix: a path prefix, or one exact module. `world/services/peer.ts` loads
 * the optional peers by name for their owners, and carries none of its own.
 */
export const ENGINE_OWNERS: Readonly<Record<string, readonly string[]>> = {
    '@hono/node-server': ['src/facets/api/'],
    '@vitest/browser-playwright': ['src/facets/component/', 'src/vitest/'],
    'better-sqlite3': ['src/world/services/sqlite/'],
    hono: ['src/facets/api/'],
    msw: ['src/world/stubs/interceptor/'],
    'oxc-parser': ['lint/module-parser.ts'],
    pg: ['src/world/services/postgres/'],
    playwright: ['src/facets/website/'],
    react: ['src/facets/component/'],
    'react-dom': ['src/facets/component/'],
    redis: ['src/world/services/redis/'],
    testcontainers: ['src/world/services/containers/'],
    'vitest-browser-react': ['src/facets/component/'],
    'vitest-mock-extended': ['src/world/mocks/'],
    'vitest/browser': ['src/facets/component/'],
    webdriverio: ['src/facets/mobile/'],
    yaml: ['src/kernel/files/yaml-document.ts'],
};

/** Every path under `dir` git does not ignore, `/`-separated and prefixed by `at`, folders included. */
function listed(dir: string, at: string): { directory: boolean; path: string }[] {
    const paths: { directory: boolean; path: string }[] = [];
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
function inGround(path: string): boolean {
    return path.split('/').some((segment) => GROUND.has(segment));
}

/** Is the path a module the code runs — no test, no type test, no fixture module, no ground? */
function isProduction(path: string): boolean {
    return (
        /\.tsx?$/u.test(path) && !/\.(?:test|test-d|fixtures)\.tsx?$/u.test(path) && !inGround(path)
    );
}

/** Every specifier a module names: its imports and re-exports (types included) and each `import('…')`. */
function specifiersOf(path: string): string[] {
    const program = parseProgram(path, readFileSync(path, 'utf8'));
    if (!isNode(program)) {
        return [];
    }
    const found = childList(program, 'body').flatMap((statement) => {
        const source = stringValue(child(statement, 'source'));
        return source === undefined ? [] : [source];
    });
    walk(program, (node) => {
        const source =
            node.type === 'ImportExpression' ? stringValue(child(node, 'source')) : undefined;
        if (source !== undefined) {
            found.push(source);
        }
    });
    return found;
}

/** The repository path a relative specifier of `from` names, its `.js` read as the `.ts` it is built from. */
function targetOf(from: string, specifier: string): string {
    return posix.normalize(posix.join(posix.dirname(from), specifier)).replace(/\.js$/u, '.ts');
}

/** The facet a repository path sits in, when it sits in one. */
function facetOf(path: string): string | undefined {
    const [source, tree, facet, below] = path.split('/');
    return source === 'src' && tree === 'facets' && below !== undefined ? facet : undefined;
}

/** The production modules of the two trees that hold code, `src/` and `lint/`. */
function productionModules(root: string): string[] {
    return [...listed(resolve(root, 'src'), 'src'), ...listed(resolve(root, 'lint'), 'lint')]
        .filter(({ directory, path }) => !directory && isProduction(path))
        .map(({ path }) => path);
}

/** I9 — what `src/` holds at its root that it may not. */
export function strayRootEntries(root: string): string[] {
    return treeEntries(resolve(root, 'src'))
        .map(({ name }) => name)
        .filter((name) => !SOURCE_ROOT.includes(name))
        .map((name) => `src/${name} is no entry of the source root`)
        .toSorted();
}

/**
 * I10 — every import of a production module that crosses into a facet it is
 * not in: a facet importing another, or anything outside a facet reaching
 * below the facet's root files, but for the modules reached for their reason.
 */
export function facetCrossings(root: string): string[] {
    return productionModules(root)
        .flatMap((from) =>
            specifiersOf(resolve(root, from))
                .filter((specifier) => specifier.startsWith('.'))
                .map((specifier) => ({ from, target: targetOf(from, specifier) })),
        )
        .flatMap(({ from, target }) => {
            const into = facetOf(target);
            const own = facetOf(from);
            if (into === undefined || into === own) {
                return [];
            }
            if (own !== undefined) {
                return [`${from} imports ${target}: a facet never imports another`];
            }
            const rootFile = target.split('/').length === 4;
            return rootFile || REACHED_INSIDE_A_FACET.has(target)
                ? []
                : [`${from} imports ${target}: a facet is entered by its root files`];
        })
        .toSorted();
}

/** I11 — every engine a production module imports from outside the one slice that owns it. */
export function misplacedEngines(root: string): string[] {
    return productionModules(root)
        .flatMap((from) =>
            specifiersOf(resolve(root, from)).flatMap((specifier) => {
                const engine = Object.keys(ENGINE_OWNERS)
                    .filter((name) => specifier === name || specifier.startsWith(`${name}/`))
                    .toSorted((one, other) => other.length - one.length)[0];
                const owners = engine === undefined ? [] : (ENGINE_OWNERS[engine] ?? []);
                return engine === undefined || owners.some((owner) => from.startsWith(owner))
                    ? []
                    : [`${from} imports ${specifier}, which only ${owners.join(' or ')} imports`];
            }),
        )
        .toSorted();
}

/**
 * I12 — what a folder of `src/` may be named and hold: never a role name; at
 * least two entries, a lone file sitting at its parent instead; and at a
 * facet's root with concept folders, its face alone — `index.ts`, the
 * component's `index.browser.ts`, `<facet>.facet.ts`, `<facet>.handle.ts`,
 * `<facet>.project.ts` and their tests. Ground is exempt: it is what a test
 * stands on.
 */
export function misshapenFolders(root: string): string[] {
    const paths = listed(resolve(root, 'src'), 'src');
    const folders = paths.filter(({ directory, path }) => directory && !inGround(path));
    const childrenOf = (folder: string): string[] =>
        paths.filter(({ path }) => dirname(path) === folder).map(({ path }) => path);
    const found = folders.flatMap(({ path }) => {
        const name = path.split('/').at(-1) ?? '';
        const children = childrenOf(path);
        return [
            ...(ROLE_NAMES.has(name) ? [`${path} is named for a role, not a concept`] : []),
            ...(children.length < 2
                ? [`${path} holds ${children.length} entry: sit it at its parent`]
                : []),
        ];
    });
    const facets = folders.filter(
        ({ path }) => path.split('/').length === 3 && facetOf(`${path}/x`) !== undefined,
    );
    const faces = facets.flatMap(({ path }) => {
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
                  .map(
                      (file) =>
                          `${file} is no file of the facet's face: it belongs in a concept folder`,
                  );
    });
    return [...found, ...faces].toSorted();
}
