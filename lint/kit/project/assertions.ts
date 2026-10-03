import { child, childList, identifierName, memberPropertyName } from './ast.js';
import type { AstNode } from './ast.js';

const EXPECT_OPENERS = new Set(['poll', 'soft']);

/** `expect.soft(x)` and `expect.poll(() => x)` count: a soft assertion is an assertion. */
export function isExpectCall(node: AstNode | undefined): boolean {
    // Stryker disable next-line OptionalChaining: every caller hands a node, the end of a member chain included
    if (node?.type !== 'CallExpression') {
        return false;
    }
    const callee = child(node, 'callee');
    return (
        identifierName(callee) === 'expect' ||
        (identifierName(child(callee, 'object')) === 'expect' &&
            (EXPECT_OPENERS as ReadonlySet<unknown>).has(memberPropertyName(callee)))
    );
}

export type Assertion = {
    matcher: string;
    /** Outermost last. */
    modifiers: string[];
    subject: AstNode | undefined;
};

const MODIFIERS = new Set(['element', 'not', 'rejects', 'resolves']);

/** `expect(x).not.toBe(y)` → subject `x`, matcher `toBe`, modifiers `['not']`. */
export function assertionOf(node: AstNode): Assertion | undefined {
    // Stryker disable next-line ConditionalExpression,BlockStatement: only parentheses let a construction end a member chain on an expect() call, and they reach no reader
    if (node.type !== 'CallExpression') {
        return undefined;
    }
    const callee = child(node, 'callee');
    const matcher = memberPropertyName(callee);
    if (matcher === undefined) {
        return undefined;
    }
    const modifiers: string[] = [];
    let current = child(callee, 'object');
    // Stryker disable next-line OptionalChaining: a member always has an object
    while (current?.type === 'MemberExpression') {
        const name = memberPropertyName(current);
        if (!(MODIFIERS as ReadonlySet<unknown>).has(name)) {
            return undefined;
        }
        modifiers.unshift(String(name));
        current = child(current, 'object');
    }
    if (!isExpectCall(current)) {
        return undefined;
    }
    return { matcher, modifiers, subject: childList(current, 'arguments')[0] };
}
