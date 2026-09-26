import {
    chainRootName,
    child,
    childList,
    identifierName,
    nodeEnd,
    nodeStart,
    walk,
} from './ast.js';
import type { AstNode } from './ast.js';

/** D20 exempts a CARRIED read — a value taken from one result only to be sent in a later request of the same test — from the whole comparison. */

const CARRY_DEPTH = 4;

/** `await api.params({ cursor }).get('/facts')`, or held whole in a name the test awaits; a result's own members and `expect(…)` are never one. */
function isRequestLink(call: AstNode, test: AstNode, results: ReadonlySet<string>): boolean {
    const root = chainRootName(call);
    if (child(call, 'callee')?.type !== 'MemberExpression' || root === undefined) {
        return false;
    }
    if (root === 'expect' || results.has(root)) {
        return false;
    }
    const holder = holderOfChain(call);
    return holder?.type === 'AwaitExpression' || isAwaitedLater(holder, test);
}

function isAwaitedLater(declarator: AstNode | undefined, test: AstNode): boolean {
    const name =
        declarator?.type === 'VariableDeclarator'
            ? identifierName(child(declarator, 'id'))
            : undefined;
    if (name === undefined) {
        return false;
    }
    let awaited = false;
    walk(test, (node) => {
        awaited ||=
            node.type === 'AwaitExpression' &&
            nodeStart(node) > nodeEnd(declarator) &&
            identifierName(child(node, 'argument')) === name;
    });
    return awaited;
}

function holderOfChain(link: AstNode): AstNode | undefined {
    let top = link;
    let parent = child(top, 'parent');
    while (
        (parent?.type === 'MemberExpression' && child(parent, 'object') === top) ||
        (parent?.type === 'CallExpression' && child(parent, 'callee') === top)
    ) {
        top = parent;
        parent = child(top, 'parent');
    }
    return parent;
}

function isReference(node: AstNode): boolean {
    const parent = child(node, 'parent');
    if (parent?.type === 'MemberExpression') {
        return child(parent, 'property') !== node || parent.computed === true;
    }
    if (parent?.type === 'Property' && child(parent, 'key') === node) {
        return parent.shorthand === true;
    }
    return parent?.type !== 'VariableDeclarator' || child(parent, 'id') !== node;
}

function bindingCarried(
    declarator: AstNode,
    callback: AstNode,
    results: ReadonlySet<string>,
    depth: number,
): boolean {
    const name = identifierName(child(declarator, 'id'));
    if (name === undefined || depth >= CARRY_DEPTH) {
        return false;
    }
    const references: AstNode[] = [];
    walk(callback, (node) => {
        if (identifierName(node) === name && isReference(node)) {
            references.push(node);
        }
    });
    return (
        references.length > 0 &&
        references.every(
            (reference) =>
                nodeStart(reference) > nodeEnd(declarator) &&
                isCarried(reference, callback, results, depth + 1),
        )
    );
}

/** An `expect(…)` or a statement of its own on the way makes it a read. */
export function isCarried(
    node: AstNode,
    callback: AstNode,
    results: ReadonlySet<string>,
    depth = 0,
): boolean {
    let current = node;
    let parent = child(current, 'parent');
    while (parent !== undefined && parent !== callback) {
        if (parent.type === 'VariableDeclarator') {
            return (
                child(parent, 'init') === current &&
                bindingCarried(parent, callback, results, depth)
            );
        }
        if (parent.type === 'CallExpression' && childList(parent, 'arguments').includes(current)) {
            if (isRequestLink(parent, callback, results)) {
                return true;
            }
            if (identifierName(child(parent, 'callee')) === 'expect') {
                return false;
            }
        }
        if (parent.type.endsWith('Statement')) {
            return false;
        }
        current = parent;
        parent = child(current, 'parent');
    }
    return false;
}
