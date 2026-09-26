import { describe, expect, test } from 'vitest';

import { checkEngineOwner, checkFacetIsolation, checkLintDirection } from './source-imports.js';
import { located, ROOT, treeOf } from './source-tree.fixtures.js';

/** The self checker passes `no-cross-facet-import` (`no-cross-facet-import`) and `one-owner-per-engine` (`one-owner-per-engine`). */
describe('source-imports', () => {
    test('source-imports — the imports of the source tree (self checker passes) — `no-cross-facet-import` — a facet never imports another, and is entered from outside by its face', () => {
        // Given - the package's own tree, and one where a facet reaches another, and an entry skips the face for a root file and for a concept folder
        const crossing = treeOf({
            'src/facets/api/api.handle.ts': "\nimport type { X } from '../cli/cli.handle.js';\n",
            'src/facets/cli/cli.handle.ts': 'export type X = 1;\n',
            'src/facets/cli/process/cli.port.ts': 'export type Y = 1;\n',
            'src/index.ts':
                "export type { X } from './facets/cli/cli.handle.js';\nexport type { Y } from './facets/cli/process/cli.port.js';\n",
        });

        // Then - the package holds none; the facet's import and each reach past the face are named at the import
        expect(checkFacetIsolation(ROOT)).toStrictEqual([]);
        expect(located(checkFacetIsolation(crossing))).toStrictEqual([
            'src/facets/api/api.handle.ts:2:1 no-cross-facet-import: the facet `api` imports `src/facets/cli/cli.handle.ts`, a module of the facet `cli`',
            'src/index.ts:1:1 no-cross-facet-import: `src/facets/cli/cli.handle.ts` is reached from outside the facet `cli` by a module its face does not serve',
            'src/index.ts:2:1 no-cross-facet-import: `src/facets/cli/process/cli.port.ts` is reached inside the facet `cli`, below its root files',
        ]);
    });

    test('source-imports — the imports of the source tree (self checker passes) — `one-owner-per-engine` — each third-party engine is imported by the one slice that owns it', () => {
        // Given - the package's own tree, and one where the kernel reaches for pg and the api facet for playwright
        const misplaced = treeOf({
            'src/facets/api/api.handle.ts':
                "export async function open() {\n    return import('playwright');\n}\n",
            'src/kernel/chain/state.ts': "import type { Pool } from 'pg';\n",
            'src/world/services/postgres/postgres.adapter.ts': "import pg from 'pg';\n",
        });

        // Then - the package holds none; each import outside its owner is named at the import, with the owner
        expect(checkEngineOwner(ROOT)).toStrictEqual([]);
        expect(located(checkEngineOwner(misplaced))).toStrictEqual([
            'src/facets/api/api.handle.ts:2:12 one-owner-per-engine: `playwright` is imported outside `src/facets/website/`, the one slice that owns it',
            'src/kernel/chain/state.ts:1:1 one-owner-per-engine: `pg` is imported outside `src/world/services/postgres/`, the one slice that owns it',
        ]);
    });

    test('`lint-imports-follow-the-direction` — a lint folder imports only the folders below it, and migration only from the checker entry', () => {
        // Given - the package's own tree, and one where a reader reaches a rule, a pass reaches the mover and a rule a self module
        const upward = treeOf({
            'lint/checks/checker.cli.ts': "import { migrateTo17 } from '../migration/mover.js';\n",
            'lint/checks/tree.ts': "import { migrateTo17 } from '../migration/mover.js';\n",
            'lint/reading/role.ts': "import type { LintRule } from '../rules/rule.js';\n",
            'lint/rules/rule.ts': "import type { SelfPassId } from '../self/checks/checker.js';\n",
            'lint/rules/rule.test.ts': "import { selfPlugin } from '../self/rules/plugin.js';\n",
        });

        // Then - the package holds none; each upward edge is named at the import, the entry and the test pass
        expect(checkLintDirection(ROOT)).toStrictEqual([]);
        expect(located(checkLintDirection(upward))).toStrictEqual([
            'lint/checks/tree.ts:1:1 lint-imports-follow-the-direction: `lint/checks/tree.ts` imports `lint/migration/mover.ts`, from `migration/`, which `checks/` sits below',
            'lint/reading/role.ts:1:1 lint-imports-follow-the-direction: `lint/reading/role.ts` imports `lint/rules/rule.ts`, from `rules/`, which `reading/` sits below',
            'lint/rules/rule.ts:1:1 lint-imports-follow-the-direction: `lint/rules/rule.ts` imports `lint/self/checks/checker.ts`, from `self/`, which `rules/` sits below',
        ]);
    });
});
