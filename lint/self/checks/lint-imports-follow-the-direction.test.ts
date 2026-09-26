import { describe, expect, test } from 'vitest';

import { located, ROOT, treeOf } from '../../engine/testing/source.fixtures.js';
import { checkLintImportsFollowTheDirection } from './lint-imports-follow-the-direction.js';

describe('checkLintImportsFollowTheDirection', () => {
    test('lint-imports-follow-the-direction — the engine imports no declaration, and a consumer folder only the catalogue and the engine', () => {
        // Given - the package's own tree, and one where the engine reaches a declaration, a rule a check, the catalogue a rule, a rule a self module
        const upward = treeOf({
            'lint/engine/project/role.ts':
                "import type { LintRule } from '../../consumer/rules/plugin.js';\n",
            'lint/consumer/rules/chain/no-sleep.ts':
                "import { consumerRows } from '../../catalogue/manifest.js';\nimport { runChecker } from '../../checks/checker.js';\n",
            'lint/consumer/catalogue/manifest.ts':
                "import { recommendedRules } from '../rules/plugin.js';\n",
            'lint/consumer/checks/tree.ts':
                "import type { SelfPassId } from '../../self/checks/checker.js';\n",
            'lint/consumer/checks/tree.test.ts':
                "import { selfPlugin } from '../../self/rules/plugin.js';\n",
        });

        // Then - the package holds none; each upward edge is named at the import, and the test passes
        expect(checkLintImportsFollowTheDirection(ROOT)).toStrictEqual([]);
        expect(located(checkLintImportsFollowTheDirection(upward))).toStrictEqual([
            'lint/consumer/catalogue/manifest.ts:1:1 lint-imports-follow-the-direction: `lint/consumer/catalogue/manifest.ts` imports `lint/consumer/rules/plugin.ts`, from `consumer/rules/`, which `consumer/catalogue/` sits below',
            'lint/consumer/checks/tree.ts:1:1 lint-imports-follow-the-direction: `lint/consumer/checks/tree.ts` imports `lint/self/checks/checker.ts`, from `self/checks/`, which `consumer/checks/` sits below',
            'lint/consumer/rules/chain/no-sleep.ts:2:1 lint-imports-follow-the-direction: `lint/consumer/rules/chain/no-sleep.ts` imports `lint/consumer/checks/checker.ts`, from `consumer/checks/`, which `consumer/rules/` sits below',
            'lint/engine/project/role.ts:1:1 lint-imports-follow-the-direction: `lint/engine/project/role.ts` imports `lint/consumer/rules/plugin.ts`, from `consumer/rules/`, which `engine/` sits below',
        ]);
    });

    test('lint-imports-follow-the-direction — the entry composes consumer with the engine and never self; the product reads the engine alone, and the shipped lint/ never reads the product', () => {
        // Given - an entry reaching a rule, the engine and a self module; the product reaching the engine and a rule; the engine and a self meta-test reaching the product
        const entry = treeOf({
            'lint/engine/project/ground.ts':
                "import { facet } from '../../../src/facets/api/api.facet.js';\n",
            'lint/index.ts': [
                "export { recommendedRules } from './consumer/rules/plugin.js';",
                "export { materialAt } from './engine/project/production.js';",
                "export { selfPlugin } from './self/rules/plugin.js';",
                '',
            ].join('\n'),
            'lint/self/corpus/compositions.ts':
                "import { apiFacet } from '../../../src/facets/api/api.facet.js';\n",
            'src/kernel/files/scratch.ts': [
                "import { GROUND_DIRS } from '../../../lint/engine/project/ground.js';",
                "import { noSleep } from '../../../lint/consumer/rules/world/no-sleep.js';",
                '',
            ].join('\n'),
        });

        // Then - the entry's self import, the product reaching a rule and the engine reaching the product are named at the import
        expect(located(checkLintImportsFollowTheDirection(entry))).toStrictEqual([
            'lint/engine/project/ground.ts:1:1 lint-imports-follow-the-direction: `lint/engine/project/ground.ts` imports `src/facets/api/api.facet.ts`, from `src/`, which `engine/` sits below',
            'lint/index.ts:3:1 lint-imports-follow-the-direction: `lint/index.ts` imports `lint/self/rules/plugin.ts`, from `self/rules/`, which `lint/index.ts` sits below',
            'src/kernel/files/scratch.ts:2:1 lint-imports-follow-the-direction: `src/kernel/files/scratch.ts` imports `lint/consumer/rules/world/no-sleep.ts`, from `consumer/rules/`, which `src/` sits below',
        ]);
    });
});
