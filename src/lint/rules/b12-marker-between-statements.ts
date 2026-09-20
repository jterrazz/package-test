import {
    child,
    childList,
    findTestCallback,
    isTestCallee,
    markerComments,
    nodeEnd,
    nodeStart,
    walk,
} from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import { isTestRole, roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext } from '../types.js';

/**
 * CONVENTIONS B12 — a marker sits BETWEEN statements, never inside one.
 *
 * `const a = 1, // Then - … b = 2;` puts the narration inside a declarator
 * chain: the comment then belongs to half a statement, the section it opens
 * has no body, and B4's offsets read an order the reader does not see. The
 * declaration is what has to move: split it, and the marker lands where a
 * marker goes.
 */
export const b12MarkerBetweenStatements: LintRule = {
    create(context: RuleContext) {
        if (!isTestRole(roleOf(context.filename).role)) {
            return {};
        }
        return {
            CallExpression(node: AstNode) {
                if (!isTestCallee(child(node, 'callee'))) {
                    return;
                }
                const callback = findTestCallback(childList(node, 'arguments'));
                if (callback === undefined) {
                    return;
                }
                const markers = markerComments(
                    context.sourceCode.getCommentsInside(callback),
                ).filter((found) => found.start >= 0);
                if (markers.length === 0) {
                    return;
                }
                walk(callback, (inner: AstNode) => {
                    if (inner.type !== 'VariableDeclaration') {
                        return;
                    }
                    const declarators = childList(inner, 'declarations');
                    if (declarators.length < 2) {
                        return;
                    }
                    const start = nodeStart(inner);
                    const end = nodeEnd(inner);
                    if (start < 0 || end < 0) {
                        return;
                    }
                    for (const found of markers) {
                        if (found.start > start && found.start < end) {
                            context.report({ messageId: 'insideDeclaration', node: inner });
                        }
                    }
                });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['b12-marker-between-statements'],
        messages: {
            insideDeclaration:
                'The marker is inside `const a = …, b = …`: split the declaration so it sits between statements.',
        },
        type: 'problem',
    },
};
