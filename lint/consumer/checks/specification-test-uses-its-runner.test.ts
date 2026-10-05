import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../kit/testing/package-tree.fixtures.js';
import { checkSpecificationTestUsesItsRunner } from './specification-test-uses-its-runner.js';

const RUNS = "import { api } from '../../api.specification.js';\n";

describe('checkSpecificationTestUsesItsRunner', () => {
    test('a test under a specification with a runner that reaches none is named, and nothing else', () => {
        // Given - a specification with a runner, its tests reaching it or not, a golden named like a test, a module beside a test, and a specification with no runner
        const root = packageWith({
            'specs/api/api.specification.ts': 'export {};\n',
            'specs/api/orders/_expected/old.test.ts': 'export {};\n',
            'specs/api/orders/helper.ts': 'export {};\n',
            'specs/api/orders/list.spec.ts': RUNS,
            'specs/api/orders/lone.test.ts': 'export {};\n',
            'specs/cli/run/lone.test.ts': 'export {};\n',
            'specs/tools/lone.test.ts': 'export {};\n',
        });

        // Then - the one test that drives nothing
        expect(checkSpecificationTestUsesItsRunner(join(root, 'specs'))).toStrictEqual([
            {
                fix: 'import `{ api }` from `api.specification.js` and drive the product through it, or move the module test beside its module',
                found: 'a test under the `api` specification that reaches no runner',
                line: 1,
                path: 'api/orders/lone.test.ts',
                rule: 'specification-test-uses-its-runner',
            },
        ]);
    });
});
