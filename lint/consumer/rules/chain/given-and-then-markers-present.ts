import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, childList } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import {
    findTestCallback,
    firstMarkerAt,
    hasMarker,
    isTestCallee,
    markerComments,
    testCalleeHasModifier,
} from '../../../kit/project/test-calls.js';
import { consumerRows } from '../../catalogue/manifest.js';

const row = rowNamed(consumerRows, 'given-and-then-markers-present');

/** Order is judged on first occurrences; an expect before the Then is allowed (preconditions, update-mode writes). A `test.each` table is judged once, on the table, where its narration interpolates `$label`. */
export const givenAndThenMarkersPresent = defineRule(
    {
        docs: row,
        messages: {
            givenAfterThen: {
                found: '`// Given -` written after `// Then -`',
                fix: 'move the Given marker above the setup it narrates, before the Then',
            },
            missing: {
                found: 'the test has no `// {{marker}} -` marker',
                fix: 'write `// {{marker}} - <a sentence about the subject>` — every test carries a Given, then a Then',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                CallExpression(node: AstNode) {
                    if (!isTestCallee(child(node, 'callee'))) {
                        return;
                    }
                    const callback = findTestCallback(childList(node, 'arguments'));
                    if (callback === undefined) {
                        return;
                    }
                    // invariant: a table's narration sits in the argument list, before the title.
                    const scope = testCalleeHasModifier(child(node, 'callee'), 'each')
                        ? node
                        : callback;
                    const markers = markerComments(context.sourceCode.getCommentsInside(scope));
                    if (!hasMarker(markers, 'Given')) {
                        context.report({ data: { marker: 'Given' }, messageId: 'missing', node });
                    }
                    if (!hasMarker(markers, 'Then')) {
                        context.report({ data: { marker: 'Then' }, messageId: 'missing', node });
                    }
                    const givenOffset = firstMarkerAt(markers, 'Given');
                    const thenOffset = firstMarkerAt(markers, 'Then');
                    // Stryker disable next-line ConditionalExpression,EqualityOperator: a missing marker is -1, and no two markers share an offset
                    if (givenOffset >= 0 && thenOffset >= 0 && givenOffset > thenOffset) {
                        context.report({ messageId: 'givenAfterThen', node });
                    }
                },
            };
        },
    },
);
