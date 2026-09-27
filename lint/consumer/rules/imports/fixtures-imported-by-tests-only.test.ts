import { asOxlintRule, ruleTester } from '../../../engine/testing/rule-tester.fixtures.js';
import { fixturesImportedByTestsOnly } from './fixtures-imported-by-tests-only.js';

ruleTester().run('fixtures-imported-by-tests-only', asOxlintRule(fixturesImportedByTestsOnly), {
    invalid: [
        // Prod file.
        {
            code: 'import { data } from "./user.fixtures.js";',
            errors: 1,
            filename: '/repo/src/domain/user.ts',
        },
        // Every form a module names another in.
        {
            code: 'const { data } = require("./user.fixtures.js");',
            errors: 1,
            filename: '/repo/src/domain/user.ts',
        },
        // A fixtures module importing another fixtures module.
        {
            code: 'import { base } from "./base.fixtures.js";',
            errors: 1,
            filename: '/repo/src/domain/user.fixtures.ts',
        },
    ],
    valid: [
        // The one sanctioned importer.
        {
            code: 'import { data } from "./user.fixtures.js";',
            filename: '/repo/src/domain/user.test.ts',
        },
        // Non-fixtures imports are untouched.
        {
            code: 'import { other } from "./other.js";',
            filename: '/repo/src/domain/user.ts',
        },
    ],
});
