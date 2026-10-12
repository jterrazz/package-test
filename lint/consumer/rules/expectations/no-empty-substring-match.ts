import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, childList, memberPropertyName } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { consumerRows } from '../../catalogue/manifest.js';

const PLAIN_STRING_MEMBERS = new Set(['content', 'raw', 'text']);

function hasCooked(value: unknown): value is { cooked: unknown } {
    // Stryker disable next-line ConditionalExpression,LogicalOperator: the value of a quasi is always an object holding its cooked text
    return typeof value === 'object' && value !== null && 'cooked' in value;
}

function isEmptyText(node: AstNode | undefined): boolean {
    if (node?.type === 'Literal') {
        return node.value === '';
    }
    // Stryker disable next-line ConditionalExpression,BlockStatement: a node that is no template has no quasis, so its cooked text is none and the answer is false all the same
    if (node?.type !== 'TemplateLiteral') {
        return false;
    }
    const [quasi] = childList(node, 'quasis');
    // Stryker disable next-line OptionalChaining: a template always holds its first quasi
    const value: unknown = quasi?.value;

    return childList(node, 'expressions').length === 0 && hasCooked(value) && value.cooked === '';
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
        // Stryker disable next-line StringLiteral: the label the editor shows the rule under, which the linter does not read to run it
        type: 'suggestion',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                CallExpression(node: AstNode) {
                    const callee = child(node, 'callee');
                    // Stryker disable next-line ConditionalExpression: a call always has a callee, and `memberPropertyName` reads an absent one as no member
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
                    // Stryker disable next-line ConditionalExpression: `memberPropertyName` reads an absent subject as no member
                    const member = subject === undefined ? undefined : memberPropertyName(subject);
                    // Stryker disable next-line ConditionalExpression: a member that is absent is in no set of members
                    const plain = member !== undefined && PLAIN_STRING_MEMBERS.has(member);
                    if (plain && isEmptyText(childList(node, 'arguments')[0])) {
                        context.report({ messageId: 'emptySubstring', node });
                    }
                },
            };
        },
    },
);
