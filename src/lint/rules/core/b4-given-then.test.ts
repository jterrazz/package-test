import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { b4GivenThen } from './b4-given-then.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('b4-given-then', b4GivenThen as unknown as OxlintRule, {
    invalid: [
        // Missing Given.
        {
            code: `test("x", () => {
                // Then - it works
            });`,
            errors: [{ messageId: 'missing' }],
        },
        // Missing Then.
        {
            code: `test("x", () => {
                // Given - a thing
            });`,
            errors: [{ messageId: 'missing' }],
        },
        // Missing both.
        {
            code: 'test("x", () => {});',
            errors: [{ messageId: 'missing' }, { messageId: 'missing' }],
        },
        // Given after Then — narrative order violated.
        {
            code: `test("x", () => {
                // Then - it works
                // Given - a thing
            });`,
            errors: [{ messageId: 'givenAfterThen' }],
        },
        // Wrapper form still enforced.
        {
            code: `test.skipIf(cond)("x", () => {
                // Given - a thing
            });`,
            errors: [{ messageId: 'missing' }],
        },
    ],
    valid: [
        // Both present.
        {
            code: `test("x", () => {
                // Given - a thing
                // Then - it works
            });`,
        },
        // When is optional.
        {
            code: `test("x", () => {
                // Given - a thing
                // When - the action runs
                // Then - it works
            });`,
        },
        // Wrapper form (skipIf) with both markers.
        {
            code: `test.skipIf(cond)("x", () => {
                // Given - a thing
                // Then - it works
            });`,
        },
        // Not a test call — untouched.
        {
            code: `helper("x", () => {
                doThing();
            });`,
        },
        // Correct order with an assertion under Then.
        {
            code: `test("x", () => {
                // Given - a thing
                // Then - it works
                expect(a).toBe(b);
            });`,
        },
        // Setup-phase assertion before Then is allowed (precondition check).
        {
            code: `test("x", () => {
                // Given - a seeded precondition
                expect(precondition).toBe(true);
                // Then - the action holds
                expect(a).toBe(b);
            });`,
        },
    ],
});
