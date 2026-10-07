import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import {
    child,
    childList,
    findProperty,
    memberPropertyName,
    specificationMember,
    stringValue,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { TOKEN_KINDS } from '../../../kit/project/tokens.js';
import { consumerRows } from '../../catalogue/manifest.js';

const KNOWN_TOKEN_LITERAL = new RegExp(
    `^\\{\\{(?:${TOKEN_KINDS.join('|')})(?:#[\\w.-]+)?\\}\\}$`,
    'u',
);

// invariant: the expression a function returns: its concise body, or the one `return` of a block.
function returned(fn: AstNode): AstNode | undefined {
    const body = child(fn, 'body');
    // Stryker disable next-line OptionalChaining: a function always has a body
    if (body?.type !== 'BlockStatement') {
        return body;
    }
    const statements = childList(body, 'body');
    const [only] = statements;
    // Stryker disable next-line OptionalChaining: one statement is always there
    return statements.length === 1 && only?.type === 'ReturnStatement'
        ? child(only, 'argument')
        : undefined;
}

function tokenReplaceReceiver(call: AstNode): AstNode | undefined {
    const callee = child(call, 'callee');
    // Stryker disable next-line ConditionalExpression,LogicalOperator: a call always has a callee
    if (callee === undefined || memberPropertyName(callee) !== 'replace') {
        return undefined;
    }
    const replacement = stringValue(childList(call, 'arguments')[1]);
    // Stryker disable next-line ConditionalExpression: no literal is no token
    return replacement !== undefined && KNOWN_TOKEN_LITERAL.test(replacement)
        ? child(callee, 'object')
        : undefined;
}

// invariant: every replacement must be a string literal that is exactly a known `{{token}}`.
function isTokenEquivalentTransform(fn: AstNode): boolean {
    // Stryker disable next-line ConditionalExpression: a value that is no function returns nothing to read
    if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') {
        return false;
    }
    let expression = returned(fn);
    let replaces = 0;
    while (expression?.type === 'CallExpression') {
        expression = tokenReplaceReceiver(expression);
        // Stryker disable next-line ConditionalExpression,BlockStatement: no receiver ends the loop on no identifier
        if (expression === undefined) {
            return false;
        }
        replaces += 1;
    }
    // Stryker disable next-line OptionalChaining: nothing returned is no replace either
    return replaces > 0 && expression?.type === 'Identifier';
}

const row = rowNamed(consumerRows, 'no-transform-duplicating-tokens');

export const noTransformDuplicatingTokens = defineRule(
    {
        docs: row,
        messages: {
            tokenEquivalent: {
                found: 'a `transform` that only rewrites output into token literals',
                fix: 'delete the transform and write the tokens in the expectation; `transform` is for noise no token covers',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'suggestion',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                CallExpression(node: AstNode) {
                    if (specificationMember(node) === undefined) {
                        return;
                    }
                    for (const argument of childList(node, 'arguments')) {
                        const transform = findProperty(argument, 'transform');
                        const fn = child(transform, 'value');
                        if (fn !== undefined && isTokenEquivalentTransform(fn)) {
                            context.report({
                                messageId: 'tokenEquivalent',
                                node: transform ?? node,
                            });
                        }
                    }
                },
            };
        },
    },
);
