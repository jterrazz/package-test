import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import {
    child,
    childList,
    findTestCallback,
    firstMarkerAt,
    hasMarker,
    isTestCallee,
    markerComments,
    testCalleeHasModifier,
} from '../../reading/ast.js';
import type { AstNode } from '../../reading/ast.js';
import type { LintRule, Visitor } from '../rule.js';

/** Order is judged on first occurrences; an expect before the Then is allowed (preconditions, update-mode writes). A `test.each` table is judged once, on the table, where its narration interpolates `$label`. */
export const givenAndThenMarkersPresent: LintRule = {
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
                // A table's narration sits in the argument list, before the title.
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
                if (givenOffset >= 0 && thenOffset >= 0 && givenOffset > thenOffset) {
                    context.report({ messageId: 'givenAfterThen', node });
                }
            },
        };
    },
    meta: {
        docs: rowOf('given-and-then-markers-present'),
        messages: lessons('given-and-then-markers-present', {
            givenAfterThen: {
                found: '`// Given -` written after `// Then -`',
                fix: 'move the Given marker above the setup it narrates, before the Then',
            },
            missing: {
                found: 'the test has no `// {{marker}} -` marker',
                fix: 'write `// {{marker}} - <a sentence about the subject>` — every test carries a Given, then a Then',
            },
        }),
        type: 'problem',
    },
};
