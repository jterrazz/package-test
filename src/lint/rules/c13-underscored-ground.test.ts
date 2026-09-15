import { resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { c13UnderscoredGround } from './c13-underscored-ground.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

// The rule probes the filesystem around the visited test file, so the cases run
// Against the shared E2E fixture trees rather than on synthetic paths.
const FIXTURES = resolve(import.meta.dirname, '../../../specs/_fixtures/lint-violations');

ruleTester.run('c13-underscored-ground', c13UnderscoredGround as unknown as OxlintRule, {
    invalid: [
        // The violation fixture keeps the pre-14 `expected/` beside its spec.
        {
            code: 'test("x", () => {});',
            errors: 1,
            filename: `${FIXTURES}/c13-underscored-ground/specs/app/widget/widget.test.ts`,
        },
    ],
    valid: [
        // The compliant twin carries `_expected/`.
        {
            code: 'test("x", () => {});',
            filename: `${FIXTURES}/c13-underscored-ground-ok/specs/app/widget/widget.test.ts`,
        },
        // Anchored on TEST files only: a module beside the same legacy directory
        // Is not a spec, so it is not a probe site.
        {
            code: 'export const helper = () => {};',
            filename: `${FIXTURES}/c13-underscored-ground/specs/app/widget/helper.ts`,
        },
        // Outside a specs/ tree the rule is inert.
        {
            code: 'test("x", () => {});',
            filename: '/repo/src/core/matching/match.test.ts',
        },
    ],
});
