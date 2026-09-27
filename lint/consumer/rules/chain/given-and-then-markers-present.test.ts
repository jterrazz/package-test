import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { givenAndThenMarkersPresent } from './given-and-then-markers-present.js';

ruleTester().run('given-and-then-markers-present', givenAndThenMarkersPresent, {
    invalid: [
        // Missing Given.
        {
            code: `test("x", () => {
                // Then - it works
            });`,
            errors: [{ column: 0, line: 1, messageId: 'missing' }],
        },
        // Missing Then.
        {
            code: `test("x", () => {
                // Given - a thing
            });`,
            errors: [{ column: 0, line: 1, messageId: 'missing' }],
        },
        // Missing both.
        {
            code: 'test("x", () => {});',
            errors: [
                { column: 0, line: 1, messageId: 'missing' },
                { column: 0, line: 1, messageId: 'missing' },
            ],
        },
        // A table narrated nowhere — neither on the table nor in the callback.
        {
            code: `test.each([{ a: 1 }])("x $a", ({ a }) => {
                expect(a).toBe(1);
            });`,
            errors: [
                { column: 0, line: 1, messageId: 'missing' },
                { column: 0, line: 1, messageId: 'missing' },
            ],
        },
        // Given after Then — narrative order violated.
        {
            code: `test("x", () => {
                // Then - it works
                // Given - a thing
            });`,
            errors: [{ column: 0, line: 1, messageId: 'givenAfterThen' }],
        },
        // Wrapper form still enforced.
        {
            code: `test.skipIf(cond)("x", () => {
                // Given - a thing
            });`,
            errors: [{ column: 0, line: 1, messageId: 'missing' }],
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
        // A table narrated ONCE, on the table — the form chapter 05 shows.
        {
            code: `test.each([
                { expected: "fresh", label: "a fresher post of equal score" },
            ])(
                // Given - $label
                // Then - it leads the ranking
                "ranks $label first",
                ({ expected }) => {
                    expect(rank(posts)[0].id).toBe(expected);
                },
            );`,
        },
        // A table narrated inside the callback is still narrated.
        {
            code: `test.each([{ a: 1 }])("x $a", ({ a }) => {
                // Given - a row
                // Then - it holds
                expect(a).toBe(1);
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
