import { asOxlintRule, ruleTester } from '../../../engine/testing/rule-tester.fixtures.js';
import { noUnpublishedSubpath } from './no-unpublished-subpath.js';

ruleTester().run('no-unpublished-subpath', asOxlintRule(noUnpublishedSubpath), {
    invalid: [
        // A re-export reaches the subpath as surely as an import, and is reported where it is written.
        {
            code: 'const a = 1;\nexport { match } from "@jterrazz/test/matching";',
            errors: [{ column: 22, line: 2, messageId: 'subpath' }],
            filename: '/repo/specs/cli/exec/exec.test.ts',
        },
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
        // Every subpath the package's own `exports` map publishes is exempt —
        // `/vitest` is what a vitest.config.ts imports the literate() plugin from.
        {
            code: 'import { literate } from "@jterrazz/test/vitest";',
            filename: '/repo/vitest.config.ts',
        },
        // Other scoped packages are untouched.
        {
            code: 'import { thing } from "@jterrazz/http/client";',
            filename: '/repo/src/tooling.ts',
        },
    ],
});
