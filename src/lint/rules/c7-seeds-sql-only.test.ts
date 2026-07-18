import { resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { c7SeedsSqlOnly } from './c7-seeds-sql-only.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

// The fs-anchored cases run against the shared E2E fixture trees.
const FIXTURES = resolve(import.meta.dirname, '../../../specs/fixtures/lint-violations');

ruleTester.run('c7-seeds-sql-only', c7SeedsSqlOnly as unknown as OxlintRule, {
    invalid: [
        // The violation fixture keeps a .json next to the .sql.
        {
            code: 'test("x", () => {});',
            errors: 1,
            filename: `${FIXTURES}/c7-seeds-sql-only/specs/app/widget/widget.test.ts`,
        },
    ],
    valid: [
        // Only .sql fragments in the compliant twin.
        {
            code: 'test("x", () => {});',
            filename: `${FIXTURES}/c7-seeds-sql-only-ok/specs/app/widget/widget.test.ts`,
        },
        // No seeds/ directory at this level (the feature has no seeds/ sibling).
        {
            code: 'test("x", () => {});',
            filename: `${FIXTURES}/c7-seeds-sql-only-ok/specs/app/app.test.ts`,
        },
        // Outside specs/ the rule is inert.
        {
            code: 'test("x", () => {});',
            filename: '/repo/src/core/matching/match.test.ts',
        },
    ],
});
