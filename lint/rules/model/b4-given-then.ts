import {
    child,
    childList,
    findTestCallback,
    firstMarkerAt,
    hasMarker,
    isTestCallee,
    markerComments,
    testCalleeHasModifier,
} from '../../ast.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, RuleContext } from '../../types.js';

/**
 * CONVENTIONS B4 — every test carries `// Given -` and `// Then -` (always both),
 * in that order. `// When -` is optional: the spec chain is usually the "when",
 * and where it is written B10 holds its place.
 *
 * Presence is the keystone (comments are reachable via
 * `sourceCode.getCommentsInside(callback)`); the position upgrade adds the
 * unambiguous narrative ordering — Given before Then, judged on FIRST
 * occurrences for multi-`Then` bodies. (The stricter "first expect after Then"
 * variant is intentionally NOT enforced: setup-phase assertions — precondition
 * checks, update-mode writes before the Then narrative — are idiomatic here.)
 *
 * A `test.each` table is judged ONCE, on the TABLE: its narration is written
 * where the cases are — above the title, interpolating `$label` — because one
 * narrative covers every row and repeating it inside the callback would say
 * the same thing N times. So the comments are looked for across the whole call
 * there, not only inside the callback.
 */
export const b4GivenThen: LintRule = {
    create(context: RuleContext) {
        return {
            CallExpression(node: AstNode) {
                if (!isTestCallee(child(node, 'callee'))) {
                    return;
                }
                const callback = findTestCallback(childList(node, 'arguments'));
                if (callback === undefined) {
                    return;
                }
                // A table's narration sits in the argument list, before the
                // Title; a plain test's sits in its body.
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
        docs: RULE_DOCS['b4-given-then'],
        messages: {
            givenAfterThen:
                'The `// Given -` marker comes after `// Then -` — Given describes the setup and must precede Then.',
            missing:
                'Test is missing a `// {{marker}} -` comment — every test needs both `// Given -` and `// Then -`.',
        },
        type: 'problem',
    },
};
