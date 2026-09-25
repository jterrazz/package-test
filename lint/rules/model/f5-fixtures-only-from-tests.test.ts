import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { f5FixturesOnlyFromTests } from './f5-fixtures-only-from-tests.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('f5-fixtures-only-from-tests', f5FixturesOnlyFromTests as unknown as OxlintRule, {
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
