import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { checkoutUnder } from '../../rule-tester.fixtures.js';
import { c2HttpOnlyRequests } from './c2-http-only-requests.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

// The fs-anchored cases run against the shared E2E fixture trees.
const SPECS_LINT = resolve(import.meta.dirname, '../../../specs/lint');

/** A leaf whose requests/ holds two files that are not requests. */
const TWO_STRAYS = checkoutUnder('work', ['specs/app/widget/requests']);
writeFileSync(join(TWO_STRAYS, 'specs/app/widget/requests/order.json'), '{}\n');
writeFileSync(join(TWO_STRAYS, 'specs/app/widget/requests/notes.txt'), 'notes\n');

ruleTester.run('c2-http-only-requests', c2HttpOnlyRequests as unknown as OxlintRule, {
    invalid: [
        // Every stray is named, whatever its extension: two strays, two reports.
        {
            code: 'test("x", () => {});',
            errors: [{ messageId: 'notHttp' }, { messageId: 'notHttp' }],
            filename: `${TWO_STRAYS}/specs/app/widget/widget.test.ts`,
        },
        // The violation fixture keeps a .json next to the .http.
        {
            code: 'test("x", () => {});',
            errors: 1,
            filename: `${SPECS_LINT}/c2-http-only-requests/fixtures/violation/specs/app/widget/widget.test.ts`,
        },
    ],
    valid: [
        // Only .http files in the compliant twin.
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/c2-http-only-requests/fixtures/compliant/specs/app/widget/widget.test.ts`,
        },
        // No requests/ directory at this level (the feature has no requests/ sibling).
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/c2-http-only-requests/fixtures/compliant/specs/app/app.test.ts`,
        },
        // Outside specs/ the rule is inert.
        {
            code: 'test("x", () => {});',
            filename: '/repo/src/specification/matching/match.test.ts',
        },
    ],
});
