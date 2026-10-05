import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../kit/testing/package-tree.fixtures.js';
import {
    checkSetupModuleAtLowestCommonFolder,
    fixSetupModuleAtLowestCommonFolder,
} from './setup-module-at-lowest-common-folder.js';

const reading = (...paths: string[]): string =>
    `${paths.map((path, at) => `import { v${at} } from '${path}';`).join('\n')}\ntest('a', () => {});\n`;

const TREE = {
    'package.json': JSON.stringify({ imports: { '#setup/*': './specs/cli/orders/_setup/*' } }),
    'specs/_shared/_setup/world.ts': 'export const v0 = 1;\n',
    'specs/api/api.spec.ts': reading('../_shared/_setup/world.ts', '../cli/_setup/cross.ts'),
    'specs/cli/_setup/clock.ts': 'export const v0 = 1;\n',
    'specs/cli/_setup/cross.ts': 'export const v0 = 1;\n',
    'specs/cli/_setup/helper.ts': "import { v0 } from './clock.ts';\nexport const v1 = v0;\n",
    'specs/cli/_setup/large.ts': `export const v0 = 1;\n${'\n'.repeat(400)}`,
    'specs/cli/_setup/only.ts': 'export const v0 = 1;\n',
    'specs/cli/_setup/stubs/news.ts':
        "import { v0 as at } from '../../tasks/_setup/sub/shared.ts';\nexport const v0 = at;\n",
    'specs/cli/_setup/unread.ts': 'export const v0 = 1;\n',
    'specs/cli/cli.spec.ts': reading(
        '../_shared/_setup/world.ts',
        './_setup/helper.ts',
        './_setup/cross.ts',
    ),
    'specs/cli/orders/_setup/aliased.ts': 'export const v0 = 1;\n',
    'specs/cli/orders/_setup/rows.ts':
        "import { v0 as at } from '../../_setup/clock.ts';\nexport const v0 = at;\n",
    'specs/cli/orders/listing.spec.ts': reading(
        '../_setup/clock.ts',
        './_setup/rows.ts',
        './_setup/aliased.ts',
    ),
    'specs/cli/tasks/_setup/sub/shared.ts': 'export const v0 = 1;\n',
    'specs/cli/tasks/run.spec.ts': reading('./_setup/sub/shared.ts'),
    'specs/cli/users/listing.spec.ts': reading(
        '../_setup/clock.ts',
        '../orders/_setup/rows',
        '../_setup/only.ts',
        '../_setup/large.ts',
        '../_setup/stubs/news.ts',
        '#setup/aliased.ts',
    ),
    'specs/job/_setup/edge.ts': `export const v0 = 1;\n${'\n'.repeat(395)}`,
    'specs/job/run.spec.ts': reading('./_setup/edge.ts'),
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
            'setup-module-at-lowest-common-folder specs/cli/_setup/cross.ts:1 `specs/cli/_setup/cross.ts`, whose readers share `specs/`, not `specs/cli/` — move it to `specs/_shared/_setup/cross.ts` — the `_setup/` of the lowest folder its readers share — and the paths that import it; `typescript fix` does both',
            'setup-module-at-lowest-common-folder specs/cli/_setup/helper.ts:1 `specs/cli/_setup/helper.ts`, read by `cli.spec.ts` alone — write what it holds in `specs/cli/cli.spec.ts`, and delete the module — a `_setup/` module exists only while several read it',
            'setup-module-at-lowest-common-folder specs/cli/_setup/large.ts:1 `specs/cli/_setup/large.ts`, whose readers share `specs/cli/users/`, not `specs/cli/` — move it to `specs/cli/users/_setup/large.ts` — the `_setup/` of the lowest folder its readers share — and the paths that import it; `typescript fix` does both',
            'setup-module-at-lowest-common-folder specs/cli/_setup/only.ts:1 `specs/cli/_setup/only.ts`, read by `listing.spec.ts` alone — write what it holds in `specs/cli/users/listing.spec.ts`, and delete the module — a `_setup/` module exists only while several read it',
            'setup-module-at-lowest-common-folder specs/cli/_setup/stubs/news.ts:1 `specs/cli/_setup/stubs/news.ts`, whose readers share `specs/cli/users/`, not `specs/cli/` — move it to `specs/cli/users/_setup/stubs/news.ts` — the `_setup/` of the lowest folder its readers share — and the paths that import it; `typescript fix` does both',
            'setup-module-at-lowest-common-folder specs/cli/orders/_setup/aliased.ts:1 `specs/cli/orders/_setup/aliased.ts`, whose readers share `specs/cli/`, not `specs/cli/orders/` — move it to `specs/cli/_setup/aliased.ts` — the `_setup/` of the lowest folder its readers share — and the `imports` alias that reaches it, by hand: `typescript fix` moves no module an alias reaches',
            'setup-module-at-lowest-common-folder specs/cli/orders/_setup/rows.ts:1 `specs/cli/orders/_setup/rows.ts`, whose readers share `specs/cli/`, not `specs/cli/orders/` — move it to `specs/cli/_setup/rows.ts` — the `_setup/` of the lowest folder its readers share — and the paths that import it; `typescript fix` does both',
            'setup-module-at-lowest-common-folder specs/cli/tasks/_setup/sub/shared.ts:1 `specs/cli/tasks/_setup/sub/shared.ts`, whose readers share `specs/cli/`, not `specs/cli/tasks/` — move it to `specs/cli/_setup/sub/shared.ts` — the `_setup/` of the lowest folder its readers share — and the paths that import it; `typescript fix` does both',
            'setup-module-at-lowest-common-folder specs/job/_setup/edge.ts:1 `specs/job/_setup/edge.ts`, read by `run.spec.ts` alone — write what it holds in `specs/job/run.spec.ts`, and delete the module — a `_setup/` module exists only while several read it',
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
            at('specs/cli/_setup/rows.ts'),
            at('specs/cli/users/_setup/stubs/news.ts'),
            [
                'specs/cli/orders/_setup/rows.ts',
                'specs/cli/_setup/stubs',
                'specs/cli/tasks/_setup',
            ].map((path) => existsSync(join(root, path))),
        ]).toStrictEqual([
            [
                'specs/cli/_setup/cross.ts → specs/_shared/_setup/cross.ts',
                'specs/cli/_setup/large.ts → specs/cli/users/_setup/large.ts',
                'specs/cli/_setup/stubs/news.ts → specs/cli/users/_setup/stubs/news.ts',
                'specs/cli/orders/_setup/rows.ts → specs/cli/_setup/rows.ts',
                'specs/cli/tasks/_setup/sub/shared.ts → specs/cli/_setup/sub/shared.ts',
            ],
            reading('../_setup/clock.ts', '../_setup/rows.ts', './_setup/aliased.ts'),
            reading(
                '../_setup/clock.ts',
                '../_setup/rows',
                '../_setup/only.ts',
                './_setup/large.ts',
                './_setup/stubs/news.ts',
                '#setup/aliased.ts',
            ),
            "import { v0 as at } from './clock.ts';\nexport const v0 = at;\n",
            "import { v0 as at } from '../../../_setup/sub/shared.ts';\nexport const v0 = at;\n",
            [false, false, false],
        ]);
    });
});
