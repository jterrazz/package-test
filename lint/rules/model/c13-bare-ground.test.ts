import { resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { checkoutUnder } from '../../rule-tester.fixtures.js';
import { c13BareGround } from './c13-bare-ground.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: a `LintRule` reads every node as an `AstNode`, where oxlint
// types each handler with its node's interface.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

// The rule probes the filesystem around the visited test file, so the cases run
// Against the shared E2E fixture trees rather than on synthetic paths.
const SPECS_LINT = resolve(import.meta.dirname, '../../../specs/lint');

/** A package whose module test still stands on the 16 `_expected/`. */
const MODULE_16 = checkoutUnder('work', ['src/report/_expected']);

ruleTester.run('c13-bare-ground', c13BareGround as unknown as OxlintRule, {
    invalid: [
        // The violation fixture keeps the 16.x `_expected/` beside its spec.
        {
            code: 'test("x", () => {});',
            errors: 1,
            filename: `${SPECS_LINT}/c13-bare-ground/fixtures/violation/specs/app/widget/widget.test.ts`,
        },
        // The 16 pool is named with the place 17 keeps it: the shared ground.
        {
            code: 'test("x", () => {});',
            errors: [
                { message: /rename it "expected\/"/u },
                { message: /rename it "fixtures\/"/u },
                { message: /rename it "requests\/"/u },
                { message: /rename it "seeds\/"/u },
                {
                    message:
                        /^found: "_fixtures\/" is a 16\.x ground name · .* · fix: rename it "shared\/fixtures\/"/u,
                },
            ],
            filename: `${SPECS_LINT}/c13-bare-ground/fixtures/every-16-folder/specs/app/widget/widget.test.ts`,
        },
        // A module test stands on ground as surely as a spec: its 16 folder is named too.
        {
            code: 'test("x", () => {});',
            errors: 1,
            filename: `${MODULE_16}/src/report/report.test.ts`,
        },
    ],
    valid: [
        // The compliant twin carries `expected/`.
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/c13-bare-ground/fixtures/compliant/specs/app/widget/widget.test.ts`,
        },
        // Anchored on TEST files only: a module beside the same legacy directory
        // Is not a spec, so it is not a probe site.
        {
            code: 'export const helper = () => {};',
            filename: `${SPECS_LINT}/c13-bare-ground/fixtures/violation/specs/app/widget/helper.ts`,
        },
        // A module test with no 16 folder beside it is on 17.
        {
            code: 'test("x", () => {});',
            filename: '/repo/src/specification/matching/match.test.ts',
        },
    ],
});
