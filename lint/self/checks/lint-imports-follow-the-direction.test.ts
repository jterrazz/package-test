import { describe, expect, test } from 'vitest';

import { checkLintImportsFollowTheDirection } from './lint-imports-follow-the-direction.js';
import { located, ROOT, treeOf } from './source.fixtures.js';

describe('checkLintImportsFollowTheDirection', () => {
    test('lint-imports-follow-the-direction — a lint folder imports only the folders below it, the catalogue under the rulebook, and migration only from the checker entry', () => {
        // Given - the package's own tree, and one where a reader reaches a rule, the catalogue and the rulebook reach what reads them, a pass reaches the mover and a rule a self module
        const upward = treeOf({
            'lint/catalogue/row.ts': "import { TEST_GLOBS } from '../rulebook/vitest.js';\n",
            'lint/rulebook/vitest.ts':
                "import { lessons } from '../catalogue/lesson.js';\nimport { recommendedRules } from '../rules/plugin.js';\n",
            'lint/checks/checker.cli.ts': "import { migrateTo17 } from '../migration/mover.js';\n",
            'lint/checks/tree.ts': "import { migrateTo17 } from '../migration/mover.js';\n",
            'lint/reading/role.ts': "import type { LintRule } from '../rules/rule.js';\n",
            'lint/rules/rule.ts': "import type { SelfPassId } from '../self/checks/checker.js';\n",
            'lint/rules/rule.test.ts': "import { selfPlugin } from '../self/rules/plugin.js';\n",
        });

        // Then - the package holds none; each upward edge is named at the import, the entry and the test pass
        expect(checkLintImportsFollowTheDirection(ROOT)).toStrictEqual([]);
        expect(located(checkLintImportsFollowTheDirection(upward))).toStrictEqual([
            'lint/catalogue/row.ts:1:1 lint-imports-follow-the-direction: `lint/catalogue/row.ts` imports `lint/rulebook/vitest.ts`, from `rulebook/`, which `catalogue/` sits below',
            'lint/checks/tree.ts:1:1 lint-imports-follow-the-direction: `lint/checks/tree.ts` imports `lint/migration/mover.ts`, from `migration/`, which `checks/` sits below',
            'lint/reading/role.ts:1:1 lint-imports-follow-the-direction: `lint/reading/role.ts` imports `lint/rules/rule.ts`, from `rules/`, which `reading/` sits below',
            'lint/rulebook/vitest.ts:2:1 lint-imports-follow-the-direction: `lint/rulebook/vitest.ts` imports `lint/rules/plugin.ts`, from `rules/`, which `rulebook/` sits below',
            'lint/rules/rule.ts:1:1 lint-imports-follow-the-direction: `lint/rules/rule.ts` imports `lint/self/checks/checker.ts`, from `self/`, which `rules/` sits below',
        ]);
    });

    test('lint-imports-follow-the-direction — the entry `lint/index.ts` imports any shipped folder, and neither the mover nor self', () => {
        // Given - an entry that reaches a pass, the ratchet, the mover and a self module
        const entry = treeOf({
            'lint/index.ts': [
                "export { runChecks } from './checks/checker.js';",
                "export { judge } from './ratchet/baseline.js';",
                "export { migrateTo17 } from './migration/mover.js';",
                "export { selfPlugin } from './self/rules/plugin.js';",
                '',
            ].join('\n'),
        });

        // Then - the pass and the ratchet are its to import; the mover and self are named at their import
        expect(located(checkLintImportsFollowTheDirection(entry))).toStrictEqual([
            'lint/index.ts:3:1 lint-imports-follow-the-direction: `lint/index.ts` imports `lint/migration/mover.ts`, from `migration/`, which `index/` sits below',
            'lint/index.ts:4:1 lint-imports-follow-the-direction: `lint/index.ts` imports `lint/self/rules/plugin.ts`, from `self/`, which `index/` sits below',
        ]);
    });
});
