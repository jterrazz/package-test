import { child, childList, identifierName, memberPropertyName, stringValue } from './ast.js';
import type { AstNode } from './ast.js';

/** A facet that gains a scenario adds its word here, once: three rules judge inside the callback and a fourth judges how it ends. */
export const SCENARIO_ACTIONS = new Set(['open', 'render', 'visit']);

export function scenarioCallbackOf(node: AstNode): AstNode | undefined {
    const callee = child(node, 'callee');
    const member = callee === undefined ? undefined : memberPropertyName(callee);
    if (member === undefined || !SCENARIO_ACTIONS.has(member)) {
        return undefined;
    }
    const scenario = childList(node, 'arguments').at(-1);
    return scenario?.type === 'ArrowFunctionExpression' || scenario?.type === 'FunctionExpression'
        ? scenario
        : undefined;
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
    const callee = child(node, 'callee');
    if (callee === undefined || memberPropertyName(callee) !== 'toMatch') {
        return undefined;
    }
    return diskCallOf(childList(node, 'arguments')[0]);
}
