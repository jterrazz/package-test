import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { c6ToMatchExtension } from './c6-tomatch-extension.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const VIOLATION = '/repo/specs/app/widget/widget.test.ts';

ruleTester.run('c6-tomatch-extension', c6ToMatchExtension as unknown as OxlintRule, {
    invalid: [
        // No extension.
        {
            code: 'expect(result.stdout).toMatch(file("./expected/help"));',
            errors: 1,
            filename: VIOLATION,
        },
        // A path in a subfolder still needs its extension.
        {
            code: 'expect(result.stdout).toMatch(file("./expected/build/verbose"));',
            errors: 1,
            filename: VIOLATION,
        },
    ],
    valid: [
        // Extension present.
        {
            code: 'expect(result.stdout).toMatch(file("./expected/help.txt"));',
            filename: VIOLATION,
        },
        // A tree is the directory matcher's.
        {
            code: 'await expect(result.directory("out")).toMatch(directory("./expected/tree/"));',
            filename: VIOLATION,
        },
        // Vitest's toMatch takes a value, and is untouched.
        { code: 'expect(text).toMatch("hello");', filename: VIOLATION },
        // Outside specs/ the rule is inert.
        {
            code: 'expect(text).toMatch(file("./expected/substring"));',
            filename: '/repo/src/specification/matching/match.test.ts',
        },
    ],
});
