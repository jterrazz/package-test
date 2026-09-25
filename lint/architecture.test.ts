import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { ActionSignatures } from '../src/actions/signatures.js';
import type { RouteOptionsAny } from '../src/capabilities/params/route.js';
import type { SetupSignatures } from '../src/capabilities/signatures.js';
import type { FacetParams } from '../src/model/chain/capability.js';
import { builtinsReached, definitionsIn, foldersOf, modulesOf, straysOf } from './architecture.js';
import { FRAMEWORK_LAYERS } from './self-layers.js';

/** The repository root, from this module's place inside `lint/`. */
const ROOT = resolve(import.meta.dirname, '..');

/** Every key of a union type, branch by branch. */
type KeysOf<T> = T extends unknown ? keyof T : never;

/**
 * The capability folders, each with what it holds: a setup of the chain, the
 * setup `with()` shares the others through, or an option a route action takes.
 * Pinned to the signatures' `keyof` in both directions.
 */
const CAPABILITY_FOLDERS = {
    clock: 'setup',
    env: 'setup',
    fixture: 'setup',
    headers: 'setup',
    intercept: 'setup',
    params: 'route option',
    seed: 'setup',
    viewport: 'setup',
    with: 'sharing',
    wrap: 'setup',
} satisfies Record<
    'with' | keyof SetupSignatures<unknown, FacetParams> | KeysOf<NonNullable<RouteOptionsAny>>,
    string
>;

/** The folder each terminal action is defined in — the request family shares one. */
const ACTION_FOLDERS = {
    call: 'call',
    delete: 'request',
    exec: 'exec',
    fetch: 'fetch',
    get: 'request',
    open: 'open',
    post: 'request',
    put: 'request',
    render: 'render',
    request: 'request',
    run: 'run',
    trigger: 'trigger',
    visit: 'visit',
} satisfies Record<keyof ActionSignatures<FacetParams>, string>;

/**
 * Meta-tests I7 (`i7-kernel-loads-in-a-page`) and I8
 * (`i8-definition-is-its-folder`) — the architecture a facet is composed in.
 *
 * A setup is defined once, in its own folder, and composed by every facet
 * that offers it; the component facet composes it inside a PAGE, so what the
 * kernel and a setup load must load there too.
 */
describe('the architecture a facet is composed in (meta-tests I7, I8)', () => {
    test('i7 — the kernel and every setup load no node builtin, at any depth', () => {
        // Given - the facet definer, which reaches the kernel, and every module of every capability folder
        const starts = ['src/facets/define-facet.ts', ...modulesOf(ROOT, 'capabilities', '.ts')];

        // Then - a page can load each of them: a builtin a setup reaches is a component chain that no longer bundles
        expect(builtinsReached(ROOT, starts)).toStrictEqual([]);
    });

    test('a builtin is reached through a value import at any depth, never through an `import type`', () => {
        // Given - a module importing a type from a builtin, an inline-typed name from it, and a value from a sibling that loads one
        const root = mkdtempSync(join(tmpdir(), 'architecture-'));
        mkdirSync(join(root, 'src'));
        writeFileSync(
            join(root, 'src/start.ts'),
            "import type { Stats } from 'node:fs';\nimport { type Dirent } from 'node:fs';\nimport { here } from './next.js';\nexport type { Stats, Dirent };\nexport const at = here;\n",
        );
        writeFileSync(
            join(root, 'src/next.ts'),
            "import { cwd } from 'node:process';\nexport { join } from 'path';\nexport const here = cwd;\n",
        );

        // Then - the sibling's two builtins, and the inline-typed import, which still loads its module
        expect(builtinsReached(root, ['src/start.ts'])).toStrictEqual([
            'src/next.ts imports node:process',
            'src/next.ts imports path',
            'src/start.ts imports node:fs',
        ]);
    });

    test('i8 — the capability folders are exactly the setups the signatures name, and the layer map', () => {
        // Given - the folders on disk, the signatures' own names, and the folders the layer map declares
        const declared = Object.keys(CAPABILITY_FOLDERS).toSorted();

        // Then - one folder per setup, per sharing and per route option, and the map names the same ones
        expect(foldersOf(ROOT, 'capabilities')).toStrictEqual(declared);
        expect(Object.keys(FRAMEWORK_LAYERS.capabilities.folders).toSorted()).toStrictEqual(
            declared,
        );
    });

    test('i8 — every action folder is one an action signature names, and the layer map', () => {
        // Given - the folders the signatures place their actions in
        const declared = [...new Set(Object.values(ACTION_FOLDERS))].toSorted();

        // Then - the map declares exactly them, and no folder on disk is another
        expect(Object.keys(FRAMEWORK_LAYERS.actions.folders).toSorted()).toStrictEqual(declared);
        expect(
            foldersOf(ROOT, 'actions').filter((folder) => !declared.includes(folder)),
        ).toStrictEqual([]);
    });

    test('i8 — a definition is named for its folder, tested beside itself, and armed through a port of its own', async () => {
        // Given - every definition a capability or an action module exports
        const definitions = await definitionsIn(ROOT, [
            ...modulesOf(ROOT, 'capabilities', '.capability.ts'),
            ...modulesOf(ROOT, 'actions', '.action.ts'),
        ]);

        // Then - each answers to its folder, has its test, and names a port exactly when it arms an engine
        expect(definitions.map(({ definition }) => definition.name).toSorted()).toContain('seed');
        expect(definitions.flatMap((found) => straysOf(ROOT, found, ACTION_FOLDERS))).toStrictEqual(
            [],
        );
    });
});
