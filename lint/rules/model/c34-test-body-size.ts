import type { Context } from '@oxlint/plugins';

import { child, childList, isTestCallee, nodeEnd, nodeStart } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** The most lines a test's body spans, its first and last line included. */
export const MAX_TEST_LINES = 60;

/** The function a test call runs: its last argument, when that is a function. */
function bodyOf(call: AstNode): AstNode | undefined {
    const last = childList(call, 'arguments').at(-1);
    return last?.type === 'ArrowFunctionExpression' || last?.type === 'FunctionExpression'
        ? last
        : undefined;
}

/**
 * CONVENTIONS C34 — a test's body spans at most {@link MAX_TEST_LINES} lines,
 * counted as the toolchain's `max-lines-per-function` counts: from the line
 * its function opens on to the line it closes on, blank lines and comments
 * included. The toolchain's cap does not reach a test file, where C31's one
 * `describe` is itself a function as long as the file; this rule caps what
 * that one would have, the test.
 */
export const c34TestBodySize: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => isTestRole(identityOf(context).role),
            CallExpression(node: AstNode) {
                if (!isTestCallee(child(node, 'callee'))) {
                    return;
                }
                const body = bodyOf(node);
                if (body === undefined) {
                    return;
                }
                const text = context.sourceCode.text.slice(nodeStart(body), nodeEnd(body));
                const lines = text.split('\n').length;
                if (lines > MAX_TEST_LINES) {
                    context.report({
                        data: { lines, max: MAX_TEST_LINES },
                        messageId: 'tooLong',
                        node: body,
                    });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c34-test-body-size'],
        messages: lessons('c34-test-body-size', {
            tooLong: {
                found: 'a test body of {{lines}} lines, over {{max}}',
                fix: 'split it into one test per behaviour, or move a long Given into a function the test calls',
            },
        }),
        type: 'suggestion',
    },
};
