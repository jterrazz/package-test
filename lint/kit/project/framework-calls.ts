import { child, childList, identifierName, memberPropertyName, stringValue } from './ast.js';
import type { AstNode } from './ast.js';
import { findTestCallback } from './test-calls.js';

/** A facet that gains a scenario adds its word here, once: three rules judge inside the callback and a fourth judges how it ends. */
export const SCENARIO_ACTIONS = new Set(['open', 'render', 'visit']);

/** The scenario is the last argument, when it is a function. */
export function scenarioCallbackOf(node: AstNode): AstNode | undefined {
    const action = memberPropertyName(child(node, 'callee'));
    if (!(SCENARIO_ACTIONS as ReadonlySet<unknown>).has(action)) {
        return undefined;
    }
    return findTestCallback(childList(node, 'arguments').slice(-1));
}

export type DiskCall = {
    kind: 'directory' | 'file';
    node: AstNode;
    path: string | undefined;
};

/** The bare identifier only, never a result accessor (`result.file(…)`). */
export function diskCallOf(node: AstNode | undefined): DiskCall | undefined {
    if (node?.type !== 'CallExpression') {
        return undefined;
    }
    const kind = identifierName(child(node, 'callee'));
    if (kind !== 'file' && kind !== 'directory') {
        return undefined;
    }
    const argument = childList(node, 'arguments')[0];
    return { kind, node: argument ?? node, path: stringValue(argument) };
}

export function goldenOf(node: AstNode): DiskCall | undefined {
    return memberPropertyName(child(node, 'callee')) === 'toMatch'
        ? diskCallOf(childList(node, 'arguments')[0])
        : undefined;
}
