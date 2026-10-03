import {
    chainRootName,
    child,
    childList,
    identifierName,
    nodeEnd,
    nodeStart,
    walk,
} from '../../../kit/project/ast.js';
import type { AstNode } from '../../../kit/project/ast.js';

/** `result-compared-whole` exempts a CARRIED read — a value taken from one result only to be sent in a later request of the same test — from the whole comparison. */

const CARRY_DEPTH = 4;

/** `await api.params({ cursor }).get('/facts')`, or held whole in a name the test awaits; a result's own members and `expect(…)` are never one. */
function isRequestLink(call: AstNode, test: AstNode, results: ReadonlySet<string>): boolean {
    const root = chainRootName(call);
    // Stryker disable next-line OptionalChaining: a call always has a callee
    if (child(call, 'callee')?.type !== 'MemberExpression' || root === undefined) {
        return false;
    }
    if (root === 'expect' || results.has(root)) {
        return false;
    }
    const holder = holderOfChain(call);
    // Stryker disable next-line OptionalChaining: a chain inside a test is always held by a node
    return holder?.type === 'AwaitExpression' || isAwaitedLater(holder, test);
}

function isAwaitedLater(declarator: AstNode | undefined, test: AstNode): boolean {
    const name = identifierName(child(declarator, 'id'));
    if (name === undefined) {
        return false;
    }
    let awaited = false;
    walk(test, (node) => {
        // Stryker disable next-line EqualityOperator: an await never starts where the declaration ends
        const after = nodeStart(node) > nodeEnd(declarator);
        awaited ||=
            node.type === 'AwaitExpression' &&
            after &&
            identifierName(child(node, 'argument')) === name;
    });
    return awaited;
}

function holderOfChain(link: AstNode): AstNode | undefined {
    const parent = child(link, 'parent');
    // Stryker disable next-line ConditionalExpression,BlockStatement: an absent parent holds no link either, and is what the line below returns
    if (parent === undefined) {
        return undefined;
    }
    const linked = child(parent, 'object') === link || child(parent, 'callee') === link;
    return linked ? holderOfChain(parent) : parent;
}

/** A member's property and an object's key are names, not reads, unless computed; a declaration's own name is none either. */
function isReference(node: AstNode): boolean {
    const parent = child(node, 'parent');
    if (child(parent, 'property') === node || child(parent, 'key') === node) {
        // Stryker disable next-line OptionalChaining: a node that is a parent's field has that parent
        return parent?.computed === true;
    }
    return child(parent, 'id') !== node;
}

function bindingCarried(
    declarator: AstNode,
    callback: AstNode,
    results: ReadonlySet<string>,
    depth: number,
): boolean {
    const name = identifierName(child(declarator, 'id'));
    // Stryker disable next-line ConditionalExpression,BlockStatement: an unnamed binding's walk meets the callback itself first, which starts before it
    if (name === undefined) {
        return false;
    }
    if (depth >= CARRY_DEPTH) {
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
                // Stryker disable next-line EqualityOperator: a reference never starts where its declaration ends
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
    // Stryker disable next-line ConditionalExpression,LogicalOperator: a statement always stands between a read and its callback, so the climb never reaches either end
    while (parent !== undefined && parent !== callback) {
        if (parent.type === 'VariableDeclarator') {
            // Stryker disable next-line ConditionalExpression: a read inside a declaration's own name binds no name the bindingCarried walk can follow
            const initialised = child(parent, 'init') === current;
            return initialised && bindingCarried(parent, callback, results, depth);
        }
        if (childList(parent, 'arguments').includes(current)) {
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
    // Stryker disable next-line BooleanLiteral: unreached, by the statement above every read
    return false;
}
