import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, childList, identifierName, memberPropertyName } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { consumerRows } from '../../catalogue/manifest.js';

const TEXT_MATCHERS = new Set(['toContain']);

function isRegExp(node: AstNode | undefined): boolean {
    if (node === undefined) {
        return false;
    }
    if (node.type === 'Literal') {
        return 'regex' in node;
    }
    return node.type === 'NewExpression' && identifierName(child(node, 'callee')) === 'RegExp';
}

/** A RegExp argument is exempt: a pattern carries no token grammar to lose. */
function unnegated(node: AstNode | undefined): AstNode | undefined {
    // Stryker disable next-line ConditionalExpression: a member always has an object
    return node !== undefined && memberPropertyName(node) === 'not' ? child(node, 'object') : node;
}

const row = rowNamed(consumerRows, 'no-raw-bypass');

export const noRawBypass = defineRule(
    {
        docs: row,
        messages: {
            rawBypass: {
                found: '`expect(x.raw).{{matcher}}(…)` asserts on the stream as captured',
                fix: 'compare `x.text` — ANSI stripped, `transform` applied, the text an expectation compares',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'suggestion',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                CallExpression(node: AstNode) {
                    const callee = child(node, 'callee');
                    // Stryker disable next-line ConditionalExpression: a call always has a callee
                    const matcher = callee === undefined ? undefined : memberPropertyName(callee);
                    // Stryker disable next-line ConditionalExpression: no matcher is in the set
                    if (matcher === undefined || !TEXT_MATCHERS.has(matcher)) {
                        return;
                    }
                    const expectCall = unnegated(child(callee, 'object'));
                    // Stryker disable next-line ConditionalExpression,OptionalChaining: a receiver that is no call has no callee below
                    if (expectCall?.type !== 'CallExpression') {
                        return;
                    }
                    const expectCallee = child(expectCall, 'callee');
                    // Stryker disable next-line ConditionalExpression,OptionalChaining,LogicalOperator: a call always has a callee, and only an identifier has a name
                    if (expectCallee?.type !== 'Identifier' || expectCallee.name !== 'expect') {
                        return;
                    }
                    if (isRegExp(childList(node, 'arguments')[0])) {
                        return;
                    }
                    const subject = childList(expectCall, 'arguments')[0];
                    if (subject !== undefined && memberPropertyName(subject) === 'raw') {
                        context.report({ data: { matcher }, messageId: 'rawBypass', node });
                    }
                },
            };
        },
    },
);
