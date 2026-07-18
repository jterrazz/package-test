import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { j4UniqueTestNames } from './j4-unique-test-names.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('j4-unique-test-names', j4UniqueTestNames as unknown as OxlintRule, {
    invalid: [
        // Same literal name twice.
        {
            code: `test("does a thing", () => {});
                   test("does a thing", () => {});`,
            errors: 1,
        },
        // Three times → two duplicates.
        {
            code: `test("x", () => {});
                   test("x", () => {});
                   test("x", () => {});`,
            errors: 2,
        },
    ],
    valid: [
        // Distinct names.
        {
            code: `test("a", () => {});
                   test("b", () => {});`,
        },
        // Parametrized names collide by construction — skipped.
        {
            code: `test.each([1, 2])("case %s", () => {});
                   test.each([3, 4])("case %s", () => {});`,
        },
        // Dynamic name — out of static reach.
        {
            code: `test(name, () => {});
                   test(name, () => {});`,
        },
    ],
});
