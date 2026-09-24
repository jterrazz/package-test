import type { Context } from '@oxlint/plugins';

import {
    child,
    childList,
    findTestCallback,
    firstMarkerAt,
    isTestCallee,
    markerComments,
} from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

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
    createOnce(context: Context): Visitor {
        return {
            before: () => isTestRole(identityOf(context).role),
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
        messages: lessons('b10-when-between-markers', {
            afterThen: {
                found: '`// When -` written after `// Then -`',
                fix: 'move it above the action it narrates, between Given and Then — or delete it when the chain is the action',
            },
            beforeGiven: {
                found: '`// When -` written before `// Given -`',
                fix: 'move it above the action it narrates, between Given and Then — or delete it when the chain is the action',
            },
        }),
        type: 'problem',
    },
};
