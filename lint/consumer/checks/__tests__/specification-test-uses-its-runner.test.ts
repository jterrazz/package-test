import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { checkSpecificationTestUsesItsRunner } from '../specification-test-uses-its-runner.js';

const RUNS = "import { api } from '../../api.specification.js';\n";

describe('checkSpecificationTestUsesItsRunner', () => {
    test('a test under a specification with a runner that reaches none is named, and nothing else', () => {
        // Given - a specification with a runner, its tests reaching it or not, a golden named like a test, a module beside a test, a setup module tested beside itself, and a specification with no runner
        const root = packageWith({
            'specs/api/api.specification.ts': 'export {};\n',
            'specs/api/orders/__expected__/old.test.ts': 'export {};\n',
            'specs/api/orders/helper.ts': 'export {};\n',
            'specs/api/orders/list.spec.ts': RUNS,
            'specs/api/orders/lone.test.ts': 'export {};\n',
            'specs/api/__setup__/binary.ts': 'export {};\n',
            'specs/api/__setup__/binary.test.ts': 'export {};\n',
            'specs/api/__setup__/view.tsx': 'export {};\n',
            'specs/api/__setup__/view.test.tsx': 'export {};\n',
            'specs/cli/run/lone.test.ts': 'export {};\n',
            'specs/tools/lone.test.ts': 'export {};\n',
        });

        // Then - each test that drives nothing, a specs module's own sent with its module out of the tree
        expect(checkSpecificationTestUsesItsRunner(join(root, 'specs'))).toStrictEqual([
            {
                fix: "a module of a specs tree has no module test: move `binary.ts` out of `specs/` into a code root — `src/`, or one `typescript.roots` declares, such as `scripts/` — with its test in that folder's `__tests__/`; or import `{ api }` and drive the product through it",
                found: 'a test under the `api` specification that reaches no runner',
                line: 1,
                path: 'api/__setup__/binary.test.ts',
                rule: 'specification-test-uses-its-runner',
            },
            {
                fix: "a module of a specs tree has no module test: move `view.tsx` out of `specs/` into a code root — `src/`, or one `typescript.roots` declares, such as `scripts/` — with its test in that folder's `__tests__/`; or import `{ api }` and drive the product through it",
                found: 'a test under the `api` specification that reaches no runner',
                line: 1,
                path: 'api/__setup__/view.test.tsx',
                rule: 'specification-test-uses-its-runner',
            },
            {
                fix: 'import `{ api }` from `api.specification.js` and drive the product through it, or move the module test into the `__tests__/` of its module’s folder',
                found: 'a test under the `api` specification that reaches no runner',
                line: 1,
                path: 'api/orders/lone.test.ts',
                rule: 'specification-test-uses-its-runner',
            },
        ]);
    });
});
