import { resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { c6ToMatchExtension } from './c6-tomatch-extension.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

// The fs-anchored cases run against the shared E2E fixture trees (the -ok
// Twin ships an expected/tree/ directory snapshot).
const FIXTURES = resolve(import.meta.dirname, '../../../specs/fixtures/lint-violations');
const VIOLATION = `${FIXTURES}/c6-tomatch-extension/specs/app/widget/widget.test.ts`;
const COMPLIANT = `${FIXTURES}/c6-tomatch-extension-ok/specs/app/widget/widget.test.ts`;

ruleTester.run('c6-tomatch-extension', c6ToMatchExtension as unknown as OxlintRule, {
    invalid: [
        // No extension, no expected/help/ directory.
        {
            code: 'expect(result.stdout).toMatch("help");',
            errors: 1,
            filename: VIOLATION,
        },
        // Slash-organised names still need their extension.
        {
            code: 'expect(result.stdout).toMatch("build/verbose");',
            errors: 1,
            filename: VIOLATION,
        },
    ],
    valid: [
        // Extension present.
        { code: 'expect(result.stdout).toMatch("help.txt");', filename: VIOLATION },
        // Statically visible directory subject.
        {
            code: 'await expect(result.directory("out")).toMatch("missing-tree");',
            filename: VIOLATION,
        },
        // Directory snapshot resolved on disk (expected/tree/ exists).
        {
            code: 'await expect(snapshot).toMatch("tree");',
            filename: COMPLIANT,
        },
        // Regex toMatch (vitest built-in) is untouched.
        { code: 'expect(text).toMatch(/hello/);', filename: VIOLATION },
        // Outside specs/ the rule is inert.
        {
            code: 'expect(text).toMatch("substring");',
            filename: '/repo/src/core/matching/match.test.ts',
        },
    ],
});
