import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { definitionsIn, modulesOf, outsideLoadsReached, straysOf } from './architecture.js';

const ROOT = resolve(import.meta.dirname, '../../..');

/** The setups a chain can offer, each in its own `<name>.capability.ts`. */
const SETUPS = [
    'clock',
    'env',
    'fixture',
    'headers',
    'intercept',
    'link',
    'rules',
    'seed',
    'viewport',
    'with',
    'wrap',
];

const ACTION_MODULES = {
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
};

/** Meta-tests `kernel-loads-in-a-page` (`kernel-loads-in-a-page`) and `definition-is-its-module` (`definition-is-its-module`): the component facet composes a setup inside a page, so what the kernel and a setup load must load there too. */
describe('architecture', () => {
    test('the architecture a facet is composed in (meta-tests) — `kernel-loads-in-a-page` — the kernel and every setup load no node builtin and no package, at any depth', () => {
        // Given - every module of the chain kernel, and every setup module
        const starts = [
            ...modulesOf(ROOT, 'kernel/chain', '.ts').filter(
                (path) => !path.endsWith('.test-d.ts'),
            ),
            ...modulesOf(ROOT, '', '.capability.ts'),
        ];

        // Then - a page can load each of them: a builtin a setup reaches is a component chain that no longer bundles
        expect(outsideLoadsReached(ROOT, starts)).toStrictEqual([]);
    });

    test('the architecture a facet is composed in (meta-tests `kernel-loads-in-a-page`, `definition-is-its-module`) — a builtin or a package is reached through a value or a dynamic import at any depth, never through an `import type`', () => {
        // Given - a module importing a type from a builtin, an inline-typed name from it, and a value from a sibling that loads builtins, one of them lazily, and a package
        const root = mkdtempSync(join(tmpdir(), 'architecture-'));
        mkdirSync(join(root, 'src'));
        writeFileSync(
            join(root, 'src/start.ts'),
            "import type { Stats } from 'node:fs';\nimport { type Dirent } from 'node:fs';\nimport { here } from './next.js';\nexport type { Stats, Dirent };\nexport const at = here;\n",
        );
        writeFileSync(
            join(root, 'src/next.ts'),
            "import { cwd } from 'node:process';\nimport { parse } from 'yaml';\nexport { join } from 'path';\nexport const here = cwd;\nexport const read = parse;\nexport async function later() {\n    return import('node:os');\n}\n",
        );

        // Then - the sibling's three builtins, the lazy one included, its package, which the walk cannot follow, and the inline-typed import, which still loads its module
        expect(outsideLoadsReached(root, ['src/start.ts'])).toStrictEqual([
            'src/next.ts imports node:os',
            'src/next.ts imports node:process',
            'src/next.ts imports path',
            'src/next.ts imports yaml, a package',
            'src/start.ts imports node:fs',
        ]);
    });

    test('the architecture a facet is composed in (meta-tests) — `definition-is-its-module` — the setups and the actions under src/ are exactly the ones the chain offers', async () => {
        // Given - every definition a setup or an action module exports
        const definitions = await definitionsIn(ROOT, [
            ...modulesOf(ROOT, '', '.capability.ts'),
            ...modulesOf(ROOT, '', '.action.ts'),
        ]);
        const named = (kind: string): string[] =>
            definitions
                .filter(({ definition }) => kind.includes(definition.kind))
                .map(({ definition }) => definition.name)
                .toSorted();

        // Then - one module per setup, and every action is one the list places — a verb two facets share (`run`) is each facet's own module
        expect(named('setup context')).toStrictEqual(SETUPS);
        expect([...new Set(named('action'))]).toStrictEqual(Object.keys(ACTION_MODULES).toSorted());
    });

    test('the architecture a facet is composed in (meta-tests) — `definition-is-its-module` — a definition is named for its module, tested beside itself or declared siblingless, and armed through a port of its own', async () => {
        // Given - every definition a setup or an action module exports
        const definitions = await definitionsIn(ROOT, [
            ...modulesOf(ROOT, '', '.capability.ts'),
            ...modulesOf(ROOT, '', '.action.ts'),
        ]);

        // Then - each answers to its module, has its test, and names a port exactly when it arms an adapter
        expect(definitions.flatMap((found) => straysOf(ROOT, found, ACTION_MODULES))).toStrictEqual(
            [],
        );
    });
});
