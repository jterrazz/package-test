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

    test('lint-imports-follow-the-direction — the entry composes consumer with the engine and never self, and src/ imports no lint/', () => {
        // Given - an entry that reaches a rule, the engine and a self module, and a product module reaching the engine
        const entry = treeOf({
            'lint/index.ts': [
                "export { recommendedRules } from './consumer/rules/plugin.js';",
                "export { materialAt } from './engine/project/production.js';",
                "export { selfPlugin } from './self/rules/plugin.js';",
                '',
            ].join('\n'),
            'src/kernel/files/ground.ts':
                "import { role } from '../../../lint/engine/project/role.js';\n",
        });

        // Then - the rule and the engine are its to import; self, and the product reaching lint/, are named at the import
        expect(located(checkLintImportsFollowTheDirection(entry))).toStrictEqual([
            'lint/index.ts:3:1 lint-imports-follow-the-direction: `lint/index.ts` imports `lint/self/rules/plugin.ts`, from `self/rules/`, which `lint/index.ts` sits below',
            'src/kernel/files/ground.ts:1:1 lint-imports-follow-the-direction: `src/kernel/files/ground.ts` imports `lint/engine/project/role.ts`, from `engine/`, which `src/` sits below',
        ]);
    });
});
