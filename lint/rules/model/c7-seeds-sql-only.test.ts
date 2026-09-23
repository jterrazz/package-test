import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { checkoutUnder } from '../../rule-tester.fixtures.js';
import { c7SeedsSqlOnly } from './c7-seeds-sql-only.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

// The fs-anchored cases run against the shared E2E fixture trees.
const SPECS_LINT = resolve(import.meta.dirname, '../../../specs/lint');

/** A leaf whose seeds/ holds two files that are not SQL. */
const TWO_STRAYS = checkoutUnder('work', ['specs/app/widget/seeds']);
writeFileSync(join(TWO_STRAYS, 'specs/app/widget/seeds/users.json'), '[]\n');
writeFileSync(join(TWO_STRAYS, 'specs/app/widget/seeds/users.csv'), 'id\n');

ruleTester.run('c7-seeds-sql-only', c7SeedsSqlOnly as unknown as OxlintRule, {
    invalid: [
        // Every stray is named, whatever its extension: two strays, two reports.
        {
            code: 'test("x", () => {});',
            errors: [{ messageId: 'notSql' }, { messageId: 'notSql' }],
            filename: `${TWO_STRAYS}/specs/app/widget/widget.test.ts`,
        },
        // The violation fixture keeps a .json next to the .sql.
        {
            code: 'test("x", () => {});',
            errors: 1,
            filename: `${SPECS_LINT}/c7-seeds-sql-only/fixtures/violation/specs/app/widget/widget.test.ts`,
        },
    ],
    valid: [
        // Only .sql fragments in the compliant twin.
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/c7-seeds-sql-only/fixtures/compliant/specs/app/widget/widget.test.ts`,
        },
        // No seeds/ directory at this level (the feature has no seeds/ sibling).
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/c7-seeds-sql-only/fixtures/compliant/specs/app/app.test.ts`,
        },
        // Outside specs/ the rule is inert.
        {
            code: 'test("x", () => {});',
            filename: '/repo/src/specification/matching/match.test.ts',
        },
    ],
});
