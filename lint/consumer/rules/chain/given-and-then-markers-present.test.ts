import { ruleTester } from '@jterrazz/test';

import { givenAndThenMarkersPresent } from './given-and-then-markers-present.js';

ruleTester().run('given-and-then-markers-present', givenAndThenMarkersPresent, {
    invalid: [
        {
            name: 'Missing Given.',
            code: `test("x", () => {
                // Then - it works
            });`,
            errors: [
                {
                    column: 0,
                    line: 1,
                    message: /^found: the test has no `\/\/ Given -` marker · /u,
                },
            ],
        },
        {
            name: 'Missing Then.',
            code: `test("x", () => {
                // Given - a thing
            });`,
            errors: [
                { column: 0, line: 1, message: /^found: the test has no `\/\/ Then -` marker · /u },
            ],
        },
        {
            name: 'Missing both.',
            code: 'test("x", () => {});',
            errors: [
                { column: 0, line: 1, messageId: 'missing' },
                { column: 0, line: 1, messageId: 'missing' },
            ],
        },
        {
            name: 'A table narrated nowhere — neither on the table nor in the callback.',
            code: `test.each([{ a: 1 }])("x $a", ({ a }) => {
                expect(a).toBe(1);
            });`,
            errors: [
                { column: 0, line: 1, messageId: 'missing' },
                { column: 0, line: 1, messageId: 'missing' },
            ],
        },
        {
            name: 'Given after Then — narrative order violated.',
            code: `test("x", () => {
                // Then - it works
                // Given - a thing
            });`,
            errors: [{ column: 0, line: 1, messageId: 'givenAfterThen' }],
        },
        {
            name: 'Wrapper form still enforced.',
            code: `test.skipIf(cond)("x", () => {
                // Given - a thing
            });`,
            errors: [{ column: 0, line: 1, messageId: 'missing' }],
        },
    ],
    valid: [
        {
            name: 'Both present.',
            code: `test("x", () => {
                // Given - a thing
                // Then - it works
            });`,
        },
        {
            name: 'When is optional.',
            code: `test("x", () => {
                // Given - a thing
                // When - the action runs
                // Then - it works
            });`,
        },
        {
            name: 'Wrapper form (skipIf) with both markers.',
            code: `test.skipIf(cond)("x", () => {
                // Given - a thing
                // Then - it works
            });`,
        },
        {
            name: 'Not a test call — untouched.',
            code: `helper("x", () => {
                doThing();
            });`,
        },
        {
            name: 'A table narrated ONCE, on the table — the form the Module tests page shows.',
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
        {
            name: 'A table narrated inside the callback is still narrated.',
            code: `test.each([{ a: 1 }])("x $a", ({ a }) => {
                // Given - a row
                // Then - it holds
                expect(a).toBe(1);
            });`,
        },
        {
            name: 'Correct order with an assertion under Then.',
            code: `test("x", () => {
                // Given - a thing
                // Then - it works
                expect(a).toBe(b);
            });`,
        },
        {
            name: 'Setup-phase assertion before Then is allowed (precondition check).',
            code: `test("x", () => {
                // Given - a seeded precondition
                expect(precondition).toBe(true);
                // Then - the action holds
                expect(a).toBe(b);
            });`,
        },
    ],
});
