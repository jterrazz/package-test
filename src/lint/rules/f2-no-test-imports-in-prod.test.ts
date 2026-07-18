import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { f2NoTestImportsInProd } from './f2-no-test-imports-in-prod.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const PROD_FILE = '/repo/src/domain/user.ts';

ruleTester.run('f2-no-test-imports-in-prod', f2NoTestImportsInProd as unknown as OxlintRule, {
    invalid: [
        { code: 'import { expect } from "vitest";', errors: 1, filename: PROD_FILE },
        { code: 'import { mockOf } from "@jterrazz/test";', errors: 1, filename: PROD_FILE },
        { code: 'import { helper } from "./user.test.js";', errors: 1, filename: PROD_FILE },
        { code: 'import { data } from "./user.fixtures.js";', errors: 1, filename: PROD_FILE },
    ],
    valid: [
        // Prod importing prod.
        { code: 'import { other } from "./other.js";', filename: PROD_FILE },
        // Test files import test artefacts freely.
        {
            code: 'import { mockOf } from "@jterrazz/test";',
            filename: '/repo/src/domain/user.test.ts',
        },
        {
            code: 'import { specification } from "@jterrazz/test";',
            filename: '/repo/specs/setup/api.specification.ts',
        },
        // Tool configs are exempt (vitest.config.ts imports vitest/config).
        {
            code: 'import { defineConfig } from "vitest/config";',
            filename: '/repo/vitest.config.ts',
        },
        // The tool-facing, zero-runtime lint entry is exempt even from prod code
        // (a shared oxlint preset imports it to wire the plugin — F1/F2).
        {
            code: 'import { testing } from "@jterrazz/test/oxlint";',
            filename: '/repo/presets/oxlint/base.js',
        },
    ],
});
