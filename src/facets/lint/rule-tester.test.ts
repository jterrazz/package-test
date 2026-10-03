import { describe, expect, test } from 'vitest';

import { ruleTester } from './rule-tester.js';
import type { PositionedCases } from './rule-tester.js';

const RULE = { create: () => ({}), meta: { messages: { found: 'found' } } };

/** The refusal a run of one invalid case with these errors meets, past the compiler. */
function refusalFor(errors: unknown, index = 0): string {
    const invalid = { code: 'x', errors };
    const cases: unknown = {
        invalid: [
            ...Array.from({ length: index }, () => ({
                code: 'y',
                errors: [{ column: 0, line: 1 }],
            })),
            invalid,
        ],
        valid: [],
    };
    try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the malformed case is the subject, past the compiler that refuses it
        ruleTester().run('a-rule', RULE, cases as PositionedCases);
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

describe('ruleTester', () => {
    test('ruleTester — refuses an invalid case that does not state where each error is reported, naming the case and the error', () => {
        // Given - errors as a count, none, and lists whose error lacks a line, a column, or is no object
        // Then - each refusal's finding, the case and the error named
        const findings = [
            refusalFor(1),
            refusalFor([]),
            refusalFor([{ column: 0, line: 1 }, { line: 1 }], 1),
            refusalFor([{ column: 0 }]),
            refusalFor([{ column: 0, line: '1' }]),
            refusalFor([{ column: '0', line: 1 }]),
            refusalFor([null]),
            refusalFor(['found']),
        ].map((message) => message.split('\n')[0]);
        expect(findings).toStrictEqual([
            'found: a-rule: invalid case 0, whose errors are a count',
            'found: a-rule: invalid case 0, which states no error',
            'found: a-rule: invalid case 1, whose error 1 states no line and column',
            'found: a-rule: invalid case 0, whose error 0 states no line and column',
            'found: a-rule: invalid case 0, whose error 0 states no line and column',
            'found: a-rule: invalid case 0, whose error 0 states no line and column',
            'found: a-rule: invalid case 0, whose error 0 states no line and column',
            'found: a-rule: invalid case 0, whose error 0 states no line and column',
        ]);
    });

    test('ruleTester — the refusal states the rule it holds a case to, and where it is read', () => {
        // Given - a case whose errors are a count
        const message = refusalFor(1);

        // Then - the whole refusal
        expect(message).toBe(
            [
                'found: a-rule: invalid case 0, whose errors are a count',
                'why: A rule proves where it reports, not only that it did: an error with no position passes for a report on any node.',
                'fix: state each error as an object carrying its `line` and `column`',
                'read: docs/16-lint.md#a-rule-alone-ruletester',
            ].join('\n'),
        );
    });
});
