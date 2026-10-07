import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import {
    child,
    childList,
    propertyKeyName,
    specificationMember,
    stringField,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { consumerRows } from '../../catalogue/manifest.js';

function unwrapAwaitedCall(node: AstNode | undefined): AstNode | undefined {
    let current = node;
    // Stryker disable next-line OptionalChaining: a const always has a value
    while (current?.type === 'AwaitExpression') {
        current = child(current, 'argument');
    }
    // Stryker disable next-line ConditionalExpression,OptionalChaining: specificationMember reads no member from a non-call
    return current?.type === 'CallExpression' ? current : undefined;
}

function aliasOf(property: AstNode): string | undefined {
    const value = child(property, 'value');
    const bound = value?.type === 'AssignmentPattern' ? child(value, 'left') : value;
    // Stryker disable next-line ConditionalExpression: only an identifier has a name
    return bound?.type === 'Identifier' ? stringField(bound, 'name') : undefined;
}

const row = rowNamed(consumerRows, 'no-runner-alias');

/** Renaming at the import site stays legal: the canonical name is enforced where the record is destructured. */
export const noRunnerAlias = defineRule(
    {
        docs: row,
        messages: {
            aliased: {
                found: '`{ {{key}}: {{alias}} }` renames the handle',
                fix: 'destructure `{ {{key}} }`, and rename at the import site if a local name must differ',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                VariableDeclarator(node: AstNode) {
                    const call = unwrapAwaitedCall(child(node, 'init'));
                    // Stryker disable next-line ConditionalExpression: no call has no member
                    if (call === undefined || specificationMember(call) === undefined) {
                        return;
                    }
                    const id = child(node, 'id');
                    // Stryker disable next-line ConditionalExpression,OptionalChaining: only a pattern lists properties
                    if (id?.type !== 'ObjectPattern') {
                        return;
                    }
                    for (const property of childList(id, 'properties')) {
                        const key = propertyKeyName(property);
                        const alias = aliasOf(property);
                        // Stryker disable next-line ConditionalExpression,LogicalOperator: a property with no key or no bound name renames nothing
                        if (key !== undefined && alias !== undefined && alias !== key) {
                            context.report({
                                data: { alias, key },
                                messageId: 'aliased',
                                node: property,
                            });
                        }
                    }
                },
            };
        },
    },
);
