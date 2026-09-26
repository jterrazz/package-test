import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import {
    child,
    childList,
    findTestCallback,
    firstMarkerAt,
    isTestCallee,
    markerComments,
} from '../../reading/ast.js';
import type { AstNode } from '../../reading/ast.js';
import { identityOf } from '../../reading/linted-file.js';
import { isTestRole } from '../../reading/role.js';
import type { LintRule, Visitor } from '../rule.js';

export const whenBetweenGivenAndThen: LintRule = {
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
        docs: rowOf('when-between-given-and-then'),
        messages: lessons('when-between-given-and-then', {
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
