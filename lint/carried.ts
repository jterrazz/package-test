import {
    chainRootName,
    child,
    childList,
    identifierName,
    nodeEnd,
    nodeStart,
    walk,
} from './ast.js';
import type { AstNode } from './rule-shape.js';

/**
 * A CARRIED read: a value a test takes from one result only to send it in a
 * later request of the same test — the cursor a page hands back, sent to fetch
 * the next. D20 exempts it from the whole comparison a read of a result owes.
 */

/** How many names a carried value may pass through before the rule stops following it. */
const CARRY_DEPTH = 4;

/**
 * Is this call a link of a REQUEST — a chain off a handle, awaited whole
 * (`await api.params({ cursor }).get('/facts')`), or held whole in a name the
 * test awaits (`const next = api.get('/facts'); await next`)? A result's own
 * members and `expect(…)` are never one.
 */
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

/** Does this declarator bind a name the test awaits after it (`const next = …; await next`)? */
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

/** What holds the whole chain a link belongs to — the node above its last link. */
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

/** Is this identifier a READ of its name — not a member's property nor a written key? */
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

/**
 * Does the name this declarator binds flow ONLY into later requests — read at
 * least once, and every read after it carried in turn?
 */
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

/**
 * Is this read's value CARRIED — sent in a later request of the same test
 * (a path, `params`, a body, a header), directly or through the names and
 * helpers it passes on the way? An `expect(…)` or a statement of its own on
 * the way makes it a read.
 */
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
