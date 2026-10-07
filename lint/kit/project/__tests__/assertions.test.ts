import { describe, expect, test } from 'vitest';

import { assertionOf, isExpectCall } from '../assertions.js';
import { child, childList, isNode, nodeStart } from '../ast.js';
import type { AstNode } from '../ast.js';
import { parseProgram } from '../module-parser.js';

function expressionsOf(...sources: string[]): AstNode[] {
    const program = parseProgram('a.test.ts', sources.join('\n'));
    return (isNode(program) ? childList(program, 'body') : []).flatMap(
        (statement) => child(statement, 'expression') ?? [],
    );
}

describe('assertions', () => {
    test('isExpectCall — expect(x), expect.soft(x) and expect.poll(fn), and no other call', () => {
        // Given - calls that open an assertion and calls that do not
        const calls = expressionsOf(
            'expect(a);',
            'expect.soft(a);',
            'expect.poll(() => a);',
            'expect.extend(a);',
            "expect['soft'](a);",
            'other.soft(a);',
            'check(a);',
            'new expect(a);',
            'expect;',
        );

        // Then - the three openers
        expect(calls.map((call) => isExpectCall(call))).toStrictEqual([
            true,
            true,
            true,
            false,
            false,
            false,
            false,
            false,
            false,
        ]);
    });

    test('assertionOf — the matcher, its modifiers outermost last, and the subject of a whole assertion', () => {
        // Given - assertions with and without modifiers, and calls that are no assertion
        const read = expressionsOf(
            'expect(a).toBe(b);',
            'await expect(a).resolves.not.toBe(b);',
            'expect.soft(a).not.toMatch(b);',
            'expect(a).deep.toBe(b);',
            'expect(a)[kind].toBe(b);',
            'expect(a)[matcher](b);',
            'check(a).toBe(b);',
            'expect(a);',
            'expect(a).toBe;',
            'new Wrapper(a).toBe(b);',
        ).map((expression) => {
            const call =
                expression.type === 'AwaitExpression' ? child(expression, 'argument') : expression;
            const assertion = call === undefined ? undefined : assertionOf(call);
            return assertion === undefined
                ? undefined
                : [
                      assertion.matcher,
                      assertion.modifiers,
                      nodeStart(assertion.subject ?? call ?? expression),
                  ];
        });

        // Then - each whole assertion read, the rest refused
        expect(read).toStrictEqual([
            ['toBe', [], 7],
            ['toBe', ['resolves', 'not'], 32],
            ['toMatch', ['not'], 69],
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
        ]);
    });
});
