import { resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { c11ContractDataPairing } from './c11-contract-data-pairing.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

// The rule is fs-anchored — the cases run against the shared fixture trees.
const FIXTURES = resolve(import.meta.dirname, '../../../specs/fixtures/lint-violations');

ruleTester.run('c11-contract-data-pairing', c11ContractDataPairing as unknown as OxlintRule, {
    invalid: [
        // Articles.fr.response.json has no articles.ts to serve it.
        {
            code: 'test("x", () => {});',
            errors: [{ messageId: 'orphan' }],
            filename: `${FIXTURES}/c11-contract-data-pairing/specs/app/widget/widget.test.ts`,
        },
    ],
    valid: [
        // Both payloads pair with events.ts (stem = name up to the first dot).
        {
            code: 'test("x", () => {});',
            filename: `${FIXTURES}/c11-contract-data-pairing-ok/specs/app/widget/widget.test.ts`,
        },
        // A feature with no contracts/ sibling.
        {
            code: 'test("x", () => {});',
            filename: `${FIXTURES}/c2-http-only-requests-ok/specs/app/widget/widget.test.ts`,
        },
        // Outside specs/ the rule is inert.
        {
            code: 'test("x", () => {});',
            filename: '/repo/src/core/matching/match.test.ts',
        },
    ],
});
