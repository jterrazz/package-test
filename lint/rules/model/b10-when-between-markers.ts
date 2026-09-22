import {
    child,
    childList,
    findTestCallback,
    firstMarkerAt,
    isTestCallee,
    markerComments,
} from '../../ast.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole, roleOf } from '../../role.js';
import type { AstNode, LintRule, RuleContext } from '../../types.js';

/**
 * CONVENTIONS B10 — `// When -` is optional, but where it is written it narrates
 * the ACTION, so it sits after the Given and before the Then.
 *
 * B4 holds the two mandatory markers; this rule holds the optional one's place.
 * A `When` written above the Given, or below the Then, tells the reader the
 * story in an order the code does not follow — the narration then costs more
 * than it gives, and the fix is either to move it to the action or to drop it
 * where the chain IS the action.
 */
export const b10WhenBetweenMarkers: LintRule = {
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
                const markers = markerComments(context.sourceCode.getCommentsInside(callback));
                const when = firstMarkerAt(markers, 'When');
                if (when < 0) {
                    return;
                }
                const given = firstMarkerAt(markers, 'Given');
                const then = firstMarkerAt(markers, 'Then');
                if (given >= 0 && when < given) {
                    context.report({ messageId: 'beforeGiven', node });
                    return;
                }
                if (then >= 0 && when > then) {
                    context.report({ messageId: 'afterThen', node });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['b10-when-between-markers'],
        messages: {
            afterThen:
                '`// When -` comes after `// Then -`: move it to the action it narrates, or drop it when the chain is the action.',
            beforeGiven:
                '`// When -` comes before `// Given -`: move it to the action it narrates, or drop it when the chain is the action.',
        },
        type: 'problem',
    },
};
