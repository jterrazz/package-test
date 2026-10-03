import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, childList } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import {
    findTestCallback,
    hasMarker,
    isTestCallee,
    markerComments,
} from '../../../kit/project/test-calls.js';
import type { Marker } from '../../../kit/project/test-calls.js';
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
                    // Stryker disable next-line ConditionalExpression,BlockStatement: a test with no callback holds no comment to read
                    if (callback === undefined) {
                        return;
                    }
                    const markers = markerComments(context.sourceCode.getCommentsInside(callback));
                    if (!hasMarker(markers, 'When')) {
                        return;
                    }
                    const firstOf = (one: Marker, other: Marker): Marker | undefined =>
                        // Stryker disable next-line OptionalChaining: asked of When, which is there
                        markers.find(({ marker }) => marker === one || marker === other)?.marker;
                    if (hasMarker(markers, 'Given') && firstOf('When', 'Given') === 'When') {
                        context.report({ messageId: 'beforeGiven', node });
                        return;
                    }
                    if (hasMarker(markers, 'Then') && firstOf('When', 'Then') === 'Then') {
                        context.report({ messageId: 'afterThen', node });
                    }
                },
            };
        },
    },
);
