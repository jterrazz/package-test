import { propertyKeyName, specificationMember, walk } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../oxlint-api.js';

/** Does this declarator destructure `cleanup` out of a specification call? */
function destructuresCleanup(node: AstNode): boolean {
    if (node.type !== 'VariableDeclarator') {
        return false;
    }
    let init = node.init as AstNode | undefined;
    while (init?.type === 'AwaitExpression') {
        init = init.argument as AstNode | undefined;
    }
    if (init?.type !== 'CallExpression' || specificationMember(init) === undefined) {
        return false;
    }
    const id = node.id as AstNode | undefined;
    if (id?.type !== 'ObjectPattern') {
        return false;
    }
    return ((id.properties as AstNode[] | undefined) ?? []).some(
        (property) => propertyKeyName(property) === 'cleanup',
    );
}

/** Is this an `afterAll(…)` call whose subtree references `cleanup`? */
function isAfterAllWithCleanup(node: AstNode): boolean {
    if (node.type !== 'CallExpression') {
        return false;
    }
    const callee = node.callee as AstNode | undefined;
    if (callee?.type !== 'Identifier' || callee.name !== 'afterAll') {
        return false;
    }
    let found = false;
    for (const argument of (node.arguments as AstNode[] | undefined) ?? []) {
        walk(argument, (child) => {
            if (child.type === 'Identifier' && child.name === 'cleanup') {
                found = true;
            }
        });
    }
    return found;
}

/**
 * CONVENTIONS A4 — a specification file calls `afterAll(cleanup)`. Flags a
 * `*.specification.ts` file that destructures `cleanup` from a
 * `specification.*` call but never hands it to `afterAll` (directly or inside
 * a callback).
 */
export const a4CleanupAfterall: LintRule = {
    create(context: RuleContext): Visitor {
        if (identityOf(context).role !== 'specification') {
            return {};
        }
        return {
            Program(node: AstNode) {
                let cleanupDeclarator: AstNode | undefined;
                let registered = false;
                walk(node, (child) => {
                    if (cleanupDeclarator === undefined && destructuresCleanup(child)) {
                        cleanupDeclarator = child;
                    }
                    if (!registered && isAfterAllWithCleanup(child)) {
                        registered = true;
                    }
                });
                if (cleanupDeclarator !== undefined && !registered) {
                    context.report({ messageId: 'unregistered', node: cleanupDeclarator });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['a4-cleanup-afterall'],
        messages: lessons('a4-cleanup-afterall', {
            unregistered: {
                found: '`cleanup` is destructured and never handed to `afterAll`',
                fix: 'add `afterAll(cleanup);` at the end of the specification file',
            },
        }),
        type: 'problem',
    },
};
