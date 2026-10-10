import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, childList, memberPropertyName } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { consumerRows } from '../../catalogue/manifest.js';

const PLAIN_STRING_MEMBERS = new Set(['content', 'raw', 'text']);

function isEmptyText(node: AstNode | undefined): boolean {
    if (node?.type === 'Literal') {
        return node.value === '';
    }
    if (node?.type !== 'TemplateLiteral') {
        return false;
    }
    const [quasi] = childList(node, 'quasis');
    const value: unknown = quasi?.value;

    return (
        childList(node, 'expressions').length === 0 &&
        typeof value === 'object' &&
        value !== null &&
        'cooked' in value &&
        value.cooked === ''
    );
}

const row = rowNamed(consumerRows, 'no-empty-substring-match');

export const noEmptySubstringMatch = defineRule(
    {
        docs: row,
        messages: {
            emptySubstring: {
                found: "`toMatch('')` on a plain string, where it is vitest’s substring match and holds for any text",
                fix: "compare the string whole, `expect(<result>.stdout.text).toBe('')`, or hand the accessor itself to `toMatch` so the empty value is the one update mode records",
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
                    if (callee === undefined || memberPropertyName(callee) !== 'toMatch') {
                        return;
                    }
                    const expectCall = child(callee, 'object');
                    // Stryker disable next-line ConditionalExpression,OptionalChaining: a receiver that is no call has no callee below
                    if (expectCall?.type !== 'CallExpression') {
                        return;
                    }
                    const expectCallee = child(expectCall, 'callee');
                    // Stryker disable next-line ConditionalExpression,OptionalChaining,LogicalOperator: a call always has a callee, and only an identifier has a name
                    if (expectCallee?.type !== 'Identifier' || expectCallee.name !== 'expect') {
                        return;
                    }
                    const subject = childList(expectCall, 'arguments')[0];
                    const member = subject === undefined ? undefined : memberPropertyName(subject);
                    if (
                        member !== undefined &&
                        PLAIN_STRING_MEMBERS.has(member) &&
                        isEmptyText(childList(node, 'arguments')[0])
                    ) {
                        context.report({ messageId: 'emptySubstring', node });
                    }
                },
            };
        },
    },
);
