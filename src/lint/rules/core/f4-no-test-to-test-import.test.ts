import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { f4NoTestToTestImport } from './f4-no-test-to-test-import.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const TEST_FILE = '/repo/specs/cli/exec/exec.test.ts';

ruleTester.run('f4-no-test-to-test-import', f4NoTestToTestImport as unknown as OxlintRule, {
    invalid: [
        { code: 'import { helper } from "./other.test.js";', errors: 1, filename: TEST_FILE },
        // Extension-less specifier.
        { code: 'import { helper } from "../env/env.test";', errors: 1, filename: TEST_FILE },
    ],
    valid: [
        // Fixtures neighbour and specification runner are the sanctioned channels.
        { code: 'import { data } from "./exec.fixtures.js";', filename: TEST_FILE },
        {
            code: 'import { cli } from "../../setup/cli.specification.js";',
            filename: TEST_FILE,
        },
        // Non-test files are governed by F2 instead.
        {
            code: 'import { helper } from "./other.test.js";',
            filename: '/repo/specs/cli/exec/helper.ts',
        },
    ],
});
