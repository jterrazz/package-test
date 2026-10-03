import { child, childList, identifierName, memberPropertyName } from './ast.js';
import type { AstNode } from './ast.js';

const EXPECT_OPENERS = new Set(['poll', 'soft']);

/** `expect.soft(x)` and `expect.poll(() => x)` count: a soft assertion is an assertion. */
export function isExpectCall(node: AstNode | undefined): boolean {
    if (node?.type !== 'CallExpression') {
        return false;
    }
    const callee = child(node, 'callee');
    if (callee?.type === 'Identifier') {
        return callee.name === 'expect';
    }
    if (callee?.type !== 'MemberExpression') {
        return false;
    }
    const opener = memberPropertyName(callee);
    return (
        identifierName(child(callee, 'object')) === 'expect' &&
        opener !== undefined &&
        EXPECT_OPENERS.has(opener)
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
    if (node.type !== 'CallExpression') {
        return undefined;
    }
    const callee = child(node, 'callee');
    if (callee?.type !== 'MemberExpression') {
        return undefined;
    }
    const matcher = memberPropertyName(callee);
    if (matcher === undefined) {
        return undefined;
    }
    const modifiers: string[] = [];
    let current = child(callee, 'object');
    while (current?.type === 'MemberExpression') {
        const name = memberPropertyName(current);
        if (name === undefined || !MODIFIERS.has(name)) {
            return undefined;
        }
        modifiers.unshift(name);
        current = child(current, 'object');
    }
    if (!isExpectCall(current)) {
        return undefined;
    }
    return { matcher, modifiers, subject: childList(current, 'arguments')[0] };
}
