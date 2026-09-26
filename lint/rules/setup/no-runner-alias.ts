import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import { propertyKeyName, specificationMember } from '../../reading/ast.js';
import type { AstNode } from '../../reading/ast.js';
import type { LintRule, Visitor } from '../rule.js';

function unwrapAwaitedCall(node: AstNode | undefined): AstNode | undefined {
    let current = node;
    while (current?.type === 'AwaitExpression') {
        current = current.argument as AstNode | undefined;
    }
    return current?.type === 'CallExpression' ? current : undefined;
}

/** Renaming at the import site stays legal: the canonical name is enforced where the record is destructured. */
export const noRunnerAlias: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            VariableDeclarator(node: AstNode) {
                const call = unwrapAwaitedCall(node.init as AstNode | undefined);
                if (call === undefined || specificationMember(call) === undefined) {
                    return;
                }
                const id = node.id as AstNode | undefined;
                if (id?.type !== 'ObjectPattern') {
                    return;
                }
                for (const property of (id.properties as AstNode[] | undefined) ?? []) {
                    const key = propertyKeyName(property);
                    if (key === undefined) {
                        continue;
                    }
                    let value = property.value as AstNode | undefined;
                    if (value?.type === 'AssignmentPattern') {
                        value = value.left as AstNode | undefined;
                    }
                    if (value?.type === 'Identifier' && value.name !== key) {
                        context.report({
                            data: { alias: value.name as string, key },
                            messageId: 'aliased',
                            node: property,
                        });
                    }
                }
            },
        };
    },
    meta: {
        docs: rowOf('no-runner-alias'),
        messages: lessons('no-runner-alias', {
            aliased: {
                found: '`{ {{key}}: {{alias}} }` renames the handle',
                fix: 'destructure `{ {{key}} }`, and rename at the import site if a local name must differ',
            },
        }),
        type: 'problem',
    },
};
