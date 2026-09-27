import { asOxlintRule, ruleTester } from '../../../engine/testing/rule-tester.fixtures.js';
import { noTestToTestImport } from './no-test-to-test-import.js';

const SPEC_TEST = '/repo/specs/cli/exec/exec.test.ts';
const MODULE_TEST = '/repo/src/domain/user.test.ts';

const FIX =
    /fix: under `specs\/`, move what both read into the `_setup\/` of the lowest folder they share; under `src\/`, into a sibling `<file>\.fixtures\.ts` for typed input data/u;

ruleTester().run('no-test-to-test-import', asOxlintRule(noTestToTestImport), {
    invalid: [
        {
            code: 'import { helper } from "./other.test.js";',
            errors: [{ message: FIX }],
            filename: SPEC_TEST,
        },
        // Extension-less specifier.
        {
            code: 'import { helper } from "../env/env.test";',
            errors: [{ message: /a test file imports the test file "\.\.\/env\/env\.test"/u }],
            filename: SPEC_TEST,
        },
        { code: 'import { user } from "./account.test.js";', errors: 1, filename: MODULE_TEST },
    ],
    valid: [
        // A `_setup/` module, a specification runner and a module test's typed fixtures are the sanctioned channels.
        { code: 'import { seededAt } from "../_setup/seeded-at.js";', filename: SPEC_TEST },
        { code: 'import { cli } from "../cli.specification.js";', filename: SPEC_TEST },
        { code: 'import { user } from "./user.fixtures.js";', filename: MODULE_TEST },
        // Non-test files are governed by `no-test-code-in-production` instead.
        {
            code: 'import { helper } from "./other.test.js";',
            filename: '/repo/specs/cli/_setup/helper.ts',
        },
    ],
});
