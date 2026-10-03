import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, childList, memberPropertyName, propertyKeyName } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { consumerRows } from '../../catalogue/manifest.js';

const URL_KEY = /^[A-Z0-9]+(?:_[A-Z0-9]+)*_URL$/u;

const row = rowNamed(consumerRows, 'no-redundant-service-url');

export const noRedundantServiceUrl = defineRule(
    {
        docs: row,
        messages: {
            redundant: {
                found: '`.env({ {{key}}: ….connectionString })` restates what the framework injects',
                fix: 'delete the `{{key}}` entry — the service record key already injects `<KEY>_URL`, and `DATABASE_URL`/`REDIS_URL` when unambiguous',
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
                    // Stryker disable next-line ConditionalExpression,LogicalOperator: a call always has a callee
                    if (callee === undefined || memberPropertyName(callee) !== 'env') {
                        return;
                    }
                    const argument = childList(node, 'arguments')[0];
                    // Stryker disable next-line ConditionalExpression,BlockStatement: only an object lists properties
                    if (argument?.type !== 'ObjectExpression') {
                        return;
                    }
                    for (const property of childList(argument, 'properties')) {
                        const key = propertyKeyName(property);
                        // Stryker disable next-line ConditionalExpression,LogicalOperator: no key is no URL key
                        if (key === undefined || !URL_KEY.test(key)) {
                            continue;
                        }
                        const value = child(property, 'value');
                        if (
                            // Stryker disable next-line ConditionalExpression,LogicalOperator,OptionalChaining: memberPropertyName reads no name from a non-member
                            value?.type === 'MemberExpression' &&
                            memberPropertyName(value) === 'connectionString'
                        ) {
                            context.report({
                                data: { key },
                                messageId: 'redundant',
                                node: property,
                            });
                        }
                    }
                },
            };
        },
    },
);
