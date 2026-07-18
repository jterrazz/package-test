import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { j1NoOnlySkip } from './j1-no-only-skip.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('j1-no-only-skip', j1NoOnlySkip as unknown as OxlintRule, {
    invalid: [
        { code: 'test.only("x", () => {});', errors: 1 },
        { code: 'describe.only("x", () => {});', errors: 1 },
        { code: 'it.only("x", () => {});', errors: 1 },
        { code: 'test.skip("x", () => {});', errors: 1 },
        { code: 'it.skip("x", () => {});', errors: 1 },
        { code: 'describe.skip("x", () => {});', errors: 1 },
    ],
    valid: [
        { code: 'test("x", () => {});' },
        { code: 'describe("x", () => {});' },
        { code: 'it("x", () => {});' },
        // Modifiers skipIf / runIf gate a test legitimately — not the bare only/skip.
        { code: 'test.skipIf(cond)("x", () => {});' },
        { code: 'test.runIf(cond)("x", () => {});' },
        // Unrelated members named only/skip on non-runner objects.
        { code: 'obj.only("x");' },
    ],
});
