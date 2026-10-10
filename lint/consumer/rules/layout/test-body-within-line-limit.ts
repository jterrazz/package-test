import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { assertionOf } from '../../../kit/project/assertions.js';
import { child, childList, nodeEnd, nodeStart, walk } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { isTestCallee } from '../../../kit/project/test-calls.js';
import { consumerRows } from '../../catalogue/manifest.js';

/** First and last line included. */
export const MAX_TEST_LINES = 60;

function lineAt(text: string, offset: number): number {
    // Stryker disable next-line ArithmeticOperator: lines are only ever subtracted or counted, so where they start counting is no matter
    return text.slice(0, offset).split('\n').length - 1;
}

const VALUE_MATCHERS: ReadonlySet<string> = new Set(['toEqual', 'toMatch', 'toStrictEqual']);

// invariant: the expected value of a whole comparison, `toMatch`, `toStrictEqual` or `toEqual`, past its first line is no gesture: it is the claim the test makes.
function gestureLines(text: string, body: AstNode): number {
    const first = lineAt(text, nodeStart(body));
    const last = lineAt(text, nodeEnd(body));
    const claim = new Set<number>();
    walk(body, (node) => {
        const matcher = assertionOf(node)?.matcher;
        if (matcher === undefined || !VALUE_MATCHERS.has(matcher)) {
            return;
        }
        const value = childList(node, 'arguments')[0];
        // Stryker disable next-line ConditionalExpression: a `toMatch` with no value claims no line either way
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
    // Stryker disable next-line UnaryOperator: a test call's callback is its last argument, and its second
    const last = childList(call, 'arguments').at(-1);
    // Stryker disable next-line OptionalChaining: a test call always has arguments
    return last?.type === 'ArrowFunctionExpression' || last?.type === 'FunctionExpression'
        ? last
        : undefined;
}

const row = rowNamed(consumerRows, 'test-body-within-line-limit');

/** Counted as the toolchain's `max-lines-per-function` counts, which cannot reach a test inside `one-describe-per-file`'s one `describe`. */
export const testBodyWithinLineLimit = defineRule(
    {
        docs: row,
        messages: {
            tooLong: {
                found: 'a test body of {{lines}} lines of gestures, over {{max}} — the lines of a `toMatch`, `toStrictEqual` or `toEqual` expected value are not counted',
                fix: 'split it into one test per behaviour, or move a long Given into a function the test calls',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'suggestion',
    },
    {
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
    },
);
