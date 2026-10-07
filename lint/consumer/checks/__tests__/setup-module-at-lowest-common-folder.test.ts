import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../kit/testing/package-tree.fixtures.js';
import {
    checkSetupModuleAtLowestCommonFolder,
    fixSetupModuleAtLowestCommonFolder,
} from '../setup-module-at-lowest-common-folder.js';

const reading = (...paths: string[]): string =>
    `${paths.map((path, at) => `import { v${at} } from '${path}';`).join('\n')}\ntest('a', () => {});\n`;

const TREE = {
    'package.json': JSON.stringify({ imports: { '#setup/*': './specs/cli/orders/__setup__/*' } }),
    'specs/__setup__/world.ts': 'export const v0 = 1;\n',
    'specs/api/api.spec.ts': reading('../__setup__/world.ts', '../cli/__setup__/cross.ts'),
    'specs/cli/__setup__/clock.ts': 'export const v0 = 1;\n',
    'specs/cli/__setup__/cross.ts': 'export const v0 = 1;\n',
    'specs/cli/__setup__/helper.ts': "import { v0 } from './clock.ts';\nexport const v1 = v0;\n",
    'specs/cli/__setup__/large.ts': `export const v0 = 1;\n${'\n'.repeat(400)}`,
    'specs/cli/__setup__/only.ts': 'export const v0 = 1;\n',
    'specs/cli/__setup__/stubs/news.ts':
        "import { v0 as at } from '../../tasks/__setup__/sub/shared.ts';\nexport const v0 = at;\n",
    'specs/cli/__setup__/unread.ts': 'export const v0 = 1;\n',
    'specs/cli/cli.spec.ts': reading(
        '../__setup__/world.ts',
        './__setup__/helper.ts',
        './__setup__/cross.ts',
    ),
    'specs/cli/orders/__setup__/aliased.ts': 'export const v0 = 1;\n',
    'specs/cli/orders/__setup__/rows.ts':
        "import { v0 as at } from '../../__setup__/clock.ts';\nexport const v0 = at;\n",
    'specs/cli/orders/listing.spec.ts': reading(
        '../__setup__/clock.ts',
        './__setup__/rows.ts',
        './__setup__/aliased.ts',
    ),
    'specs/cli/tasks/__setup__/sub/shared.ts': 'export const v0 = 1;\n',
    'specs/cli/tasks/run.spec.ts': reading('./__setup__/sub/shared.ts'),
    'specs/cli/users/listing.spec.ts': reading(
        '../__setup__/clock.ts',
        '../orders/__setup__/rows',
        '../__setup__/only.ts',
        '../__setup__/large.ts',
        '../__setup__/stubs/news.ts',
        '#setup/aliased.ts',
    ),
    'specs/job/__setup__/edge.ts': `export const v0 = 1;\n${'\n'.repeat(395)}`,
    'specs/job/run.spec.ts': reading('./__setup__/edge.ts'),
};

describe('setup-module-at-lowest-common-folder', () => {
    test('a setup module sits in the setup folder of the lowest folder its readers share, or in its one reader', () => {
        // Given - modules read from across specifications, by one folder, by two, by one spec small and large, through an alias, by a stub reader, and by none
        const root = packageWith(TREE);

        // Then - each misplaced module, told where it goes
        expect(
            checkSetupModuleAtLowestCommonFolder(root).map(
                ({ fix, found, line, path, rule }) => `${rule} ${path}:${line} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            'setup-module-at-lowest-common-folder specs/cli/__setup__/cross.ts:1 `specs/cli/__setup__/cross.ts`, whose readers share `specs/`, not `specs/cli/` — move it to `specs/__setup__/cross.ts` — the `__setup__/` of the lowest folder its readers share — and the paths that import it; `typescript fix` does both',
            'setup-module-at-lowest-common-folder specs/cli/__setup__/helper.ts:1 `specs/cli/__setup__/helper.ts`, read by `cli.spec.ts` alone — write what it holds in `specs/cli/cli.spec.ts`, and delete the module — a `__setup__/` module exists only while several read it',
            'setup-module-at-lowest-common-folder specs/cli/__setup__/large.ts:1 `specs/cli/__setup__/large.ts`, whose readers share `specs/cli/users/`, not `specs/cli/` — move it to `specs/cli/users/__setup__/large.ts` — the `__setup__/` of the lowest folder its readers share — and the paths that import it; `typescript fix` does both',
            'setup-module-at-lowest-common-folder specs/cli/__setup__/only.ts:1 `specs/cli/__setup__/only.ts`, read by `listing.spec.ts` alone — write what it holds in `specs/cli/users/listing.spec.ts`, and delete the module — a `__setup__/` module exists only while several read it',
            'setup-module-at-lowest-common-folder specs/cli/__setup__/stubs/news.ts:1 `specs/cli/__setup__/stubs/news.ts`, whose readers share `specs/cli/users/`, not `specs/cli/` — move it to `specs/cli/users/__setup__/stubs/news.ts` — the `__setup__/` of the lowest folder its readers share — and the paths that import it; `typescript fix` does both',
            'setup-module-at-lowest-common-folder specs/cli/orders/__setup__/aliased.ts:1 `specs/cli/orders/__setup__/aliased.ts`, whose readers share `specs/cli/`, not `specs/cli/orders/` — move it to `specs/cli/__setup__/aliased.ts` — the `__setup__/` of the lowest folder its readers share — and the `imports` alias that reaches it, by hand: `typescript fix` moves no module an alias reaches',
            'setup-module-at-lowest-common-folder specs/cli/orders/__setup__/rows.ts:1 `specs/cli/orders/__setup__/rows.ts`, whose readers share `specs/cli/`, not `specs/cli/orders/` — move it to `specs/cli/__setup__/rows.ts` — the `__setup__/` of the lowest folder its readers share — and the paths that import it; `typescript fix` does both',
            'setup-module-at-lowest-common-folder specs/cli/tasks/__setup__/sub/shared.ts:1 `specs/cli/tasks/__setup__/sub/shared.ts`, whose readers share `specs/cli/`, not `specs/cli/tasks/` — move it to `specs/cli/__setup__/sub/shared.ts` — the `__setup__/` of the lowest folder its readers share — and the paths that import it; `typescript fix` does both',
            'setup-module-at-lowest-common-folder specs/job/__setup__/edge.ts:1 `specs/job/__setup__/edge.ts`, read by `run.spec.ts` alone — write what it holds in `specs/job/run.spec.ts`, and delete the module — a `__setup__/` module exists only while several read it',
        ]);
    });

    test('the fix moves each module it can to its readers’ setup folder and repoints them, leaving aliased and taken ones', () => {
        // Given - the same tree
        const root = packageWith(TREE);

        // When - the fixer runs
        const moved = fixSetupModuleAtLowestCommonFolder(root);

        // Then - what moved, and the readers that follow it
        const at = (path: string): string | undefined =>
            existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : undefined;
        expect([
            moved,
            at('specs/cli/orders/listing.spec.ts'),
            at('specs/cli/users/listing.spec.ts'),
            at('specs/cli/__setup__/rows.ts'),
            at('specs/cli/users/__setup__/stubs/news.ts'),
            [
                'specs/cli/orders/__setup__/rows.ts',
                'specs/cli/__setup__/stubs',
                'specs/cli/tasks/__setup__',
            ].map((path) => existsSync(join(root, path))),
        ]).toStrictEqual([
            [
                'specs/cli/__setup__/cross.ts → specs/__setup__/cross.ts',
                'specs/cli/__setup__/large.ts → specs/cli/users/__setup__/large.ts',
                'specs/cli/__setup__/stubs/news.ts → specs/cli/users/__setup__/stubs/news.ts',
                'specs/cli/orders/__setup__/rows.ts → specs/cli/__setup__/rows.ts',
                'specs/cli/tasks/__setup__/sub/shared.ts → specs/cli/__setup__/sub/shared.ts',
            ],
            reading('../__setup__/clock.ts', '../__setup__/rows.ts', './__setup__/aliased.ts'),
            reading(
                '../__setup__/clock.ts',
                '../__setup__/rows',
                '../__setup__/only.ts',
                './__setup__/large.ts',
                './__setup__/stubs/news.ts',
                '#setup/aliased.ts',
            ),
            "import { v0 as at } from './clock.ts';\nexport const v0 = at;\n",
            "import { v0 as at } from '../../../__setup__/sub/shared.ts';\nexport const v0 = at;\n",
            [false, false, false],
        ]);
    });
});
