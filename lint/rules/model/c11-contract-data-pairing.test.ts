import { resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { c11ContractDataPairing } from './c11-contract-data-pairing.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

// The rule is fs-anchored — the cases run against the shared fixture trees.
const SPECS_LINT = resolve(import.meta.dirname, '../../../specs/lint');

ruleTester.run('c11-contract-data-pairing', c11ContractDataPairing as unknown as OxlintRule, {
    invalid: [
        // Articles.fr.response.json has no articles.ts to serve it.
        {
            code: 'test("x", () => {});',
            errors: [{ messageId: 'orphan' }],
            filename: `${SPECS_LINT}/c11-contract-data-pairing/fixtures/violation/specs/app/widget/widget.test.ts`,
        },
    ],
    valid: [
        // Both payloads pair with events.ts (stem = name up to the first dot).
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/c11-contract-data-pairing/fixtures/compliant/specs/app/widget/widget.test.ts`,
        },
        // A feature with no contracts/ sibling.
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/c2-http-only-requests/fixtures/compliant/specs/app/widget/widget.test.ts`,
        },
        // Outside specs/ the rule is inert.
        {
            code: 'test("x", () => {});',
            filename: '/repo/src/specification/matching/match.test.ts',
        },
    ],
});
