import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { f1NoSubpathImport } from './f1-no-subpath-import.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('f1-no-subpath-import', f1NoSubpathImport as unknown as OxlintRule, {
    invalid: [
        // Subpaths do not exist.
        {
            code: 'import { mockOf } from "@jterrazz/test/mock";',
            errors: 1,
            filename: '/repo/specs/cli/exec/exec.test.ts',
        },
    ],
    valid: [
        // The single entry point.
        {
            code: 'import { specification, match } from "@jterrazz/test";',
            filename: '/repo/specs/cli/exec/exec.test.ts',
        },
        // The sanctioned tool-facing exception — from the oxlint config.
        {
            code: 'import plugin from "@jterrazz/test/oxlint";',
            filename: '/repo/oxlint.config.ts',
        },
        // The tool-facing exception is exempt from any file (e.g. a shared preset).
        {
            code: 'import { testing } from "@jterrazz/test/oxlint";',
            filename: '/repo/presets/oxlint/base.js',
        },
        // Other scoped packages are untouched.
        {
            code: 'import { thing } from "@jterrazz/http/client";',
            filename: '/repo/src/tooling.ts',
        },
    ],
});
