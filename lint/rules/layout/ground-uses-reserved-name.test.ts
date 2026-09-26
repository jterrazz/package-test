import { resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { checkoutUnder, packageWith } from '../rule-tester.fixtures.js';
import { c13BareGround } from './ground-uses-reserved-name.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

// The rule probes the filesystem around the visited test file, so the cases run
// against the shared E2E fixture trees rather than on synthetic paths.
const SPECS_LINT = resolve(import.meta.dirname, '../../../specs/lint');

const MODULE_16 = checkoutUnder('work', ['src/report/_expected']);

const ON_16_STUBS = `${SPECS_LINT}/c13-bare-ground/fixtures/on-16-stubs`;

const PRODUCT_CONTRACTS = packageWith({
    'src/billing/billing.test.ts': 'test("x", () => {});\n',
    'src/billing/contracts/invoice.ts': 'export type Invoice = { total: number };\n',
});

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
        // A 16 stubs folder left beside a spec is named, with the mover that moves it.
        {
            code: 'test("x", () => {});',
            errors: [
                {
                    message:
                        /^found: "contracts\/" is the 16\.x name of a stubs folder · .* · fix: rename it "stubs\/", .*`jterrazz-test-check --fix`/u,
                },
            ],
            filename: `${ON_16_STUBS}/specs/api/news/list/list.spec.ts`,
        },
        // Beside a module test, a `contracts/` holding a 16 facade is the same leftover.
        {
            code: 'test("x", () => {});',
            errors: [{ message: /"contracts\/" is the 16\.x name of a stubs folder/u }],
            filename: `${ON_16_STUBS}/src/rates/rates.test.ts`,
        },
    ],
    valid: [
        // Outside a specs tree, a product's own `contracts/` — no `*.contracts.ts` facade — is not a stubs folder.
        {
            code: 'test("x", () => {});',
            filename: `${PRODUCT_CONTRACTS}/src/billing/billing.test.ts`,
        },
        // The compliant twin carries `expected/`.
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/c13-bare-ground/fixtures/compliant/specs/app/widget/widget.test.ts`,
        },
        // Anchored on TEST files only: a module beside the same legacy directory
        // is not a spec, so it is not a probe site.
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
