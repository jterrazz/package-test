import { execFileSync } from 'node:child_process';
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

/** A git checkout whose seeds/ tracks one `.sql` and holds a new, unstaged `.json` beside it. */
const UNTRACKED_STRAY = checkoutUnder('work', ['specs/app/widget/seeds']);
writeFileSync(join(UNTRACKED_STRAY, 'specs/app/widget/seeds/users.sql'), 'select 1;\n');
writeFileSync(join(UNTRACKED_STRAY, 'specs/app/widget/seeds/users.json'), '[]\n');
execFileSync('git', ['init', '--quiet'], { cwd: UNTRACKED_STRAY });
execFileSync('git', ['add', 'package.json', 'specs/app/widget/seeds/users.sql'], {
    cwd: UNTRACKED_STRAY,
});

/** The same checkout, its `.json` named by `.gitignore`. */
const IGNORED_STRAY = checkoutUnder('work', ['specs/app/widget/seeds']);
writeFileSync(join(IGNORED_STRAY, 'specs/app/widget/seeds/users.sql'), 'select 1;\n');
writeFileSync(join(IGNORED_STRAY, 'specs/app/widget/seeds/users.json'), '[]\n');
writeFileSync(join(IGNORED_STRAY, '.gitignore'), '*.json\n');
execFileSync('git', ['init', '--quiet'], { cwd: IGNORED_STRAY });

ruleTester.run('c7-seeds-sql-only', c7SeedsSqlOnly as unknown as OxlintRule, {
    invalid: [
        // Every stray is named, whatever its extension: two strays, two reports.
        {
            code: 'test("x", () => {});',
            errors: [{ messageId: 'notSql' }, { messageId: 'notSql' }],
            filename: `${TWO_STRAYS}/specs/app/widget/widget.test.ts`,
        },
        // A file nobody added is still in the tree: it violates like a tracked one.
        {
            code: 'test("x", () => {});',
            errors: [{ messageId: 'notSql' }],
            filename: `${UNTRACKED_STRAY}/specs/app/widget/widget.test.ts`,
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
        // A file `.gitignore` names is on no checkout: it violates nothing.
        {
            code: 'test("x", () => {});',
            filename: `${IGNORED_STRAY}/specs/app/widget/widget.test.ts`,
        },
        // Outside specs/ the rule is inert.
        {
            code: 'test("x", () => {});',
            filename: '/repo/src/specification/matching/match.test.ts',
        },
    ],
});
