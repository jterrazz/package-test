import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import {
    child,
    childList,
    findTestCallback,
    firstMarkerAt,
    isTestCallee,
    markerComments,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

const row = rowNamed(consumerRows, 'when-between-given-and-then');

export const whenBetweenGivenAndThen = defineRule(
    {
        docs: row,
        messages: {
            afterThen: {
                found: '`// When -` written after `// Then -`',
                fix: 'move it above the action it narrates, between Given and Then — or delete it when the chain is the action',
            },
            beforeGiven: {
                found: '`// When -` written before `// Given -`',
                fix: 'move it above the action it narrates, between Given and Then — or delete it when the chain is the action',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
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
    },
);
