import type { Context } from '@oxlint/plugins';

import {
    assertionOf,
    child,
    childList,
    isTestCallee,
    nodeEnd,
    nodeStart,
    walk,
} from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** First and last line included. */
export const MAX_TEST_LINES = 60;

function lineAt(text: string, offset: number): number {
    return text.slice(0, offset).split('\n').length - 1;
}

/** A `toMatch(<value>)` argument past its first line is no gesture: C28 caps it. */
function gestureLines(text: string, body: AstNode): number {
    const first = lineAt(text, nodeStart(body));
    const last = lineAt(text, nodeEnd(body));
    const claim = new Set<number>();
    walk(body, (node) => {
        if (assertionOf(node)?.matcher !== 'toMatch') {
            return;
        }
        const value = childList(node, 'arguments')[0];
        if (value === undefined) {
            return;
        }
        const end = lineAt(text, nodeEnd(value));
        for (let line = lineAt(text, nodeStart(value)) + 1; line <= end; line += 1) {
            claim.add(line);
        }
    });
    return last - first + 1 - claim.size;
}

function bodyOf(call: AstNode): AstNode | undefined {
    const last = childList(call, 'arguments').at(-1);
    return last?.type === 'ArrowFunctionExpression' || last?.type === 'FunctionExpression'
        ? last
        : undefined;
}

/** Counted as the toolchain's `max-lines-per-function` counts, which cannot reach a test inside C31's one `describe`. */
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
                const lines = gestureLines(context.sourceCode.text, body);
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
                found: 'a test body of {{lines}} lines of gestures, over {{max}} — the lines of a `toMatch(<value>)` argument are not counted',
                fix: 'split it into one test per behaviour, or move a long Given into a function the test calls',
            },
        }),
        type: 'suggestion',
    },
};
