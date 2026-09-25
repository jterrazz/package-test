import type { Context } from '@oxlint/plugins';

import { propertyKeyName, specificationMember } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

function unwrapAwaitedCall(node: AstNode | undefined): AstNode | undefined {
    let current = node;
    while (current?.type === 'AwaitExpression') {
        current = current.argument as AstNode | undefined;
    }
    return current?.type === 'CallExpression' ? current : undefined;
}

/** Renaming at the import site stays legal: the canonical name is enforced where the record is destructured. */
export const a3NoDestructureAlias: LintRule = {
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
        docs: RULE_DOCS['a3-no-destructure-alias'],
        messages: lessons('a3-no-destructure-alias', {
            aliased: {
                found: '`{ {{key}}: {{alias}} }` renames the handle',
                fix: 'destructure `{ {{key}} }`, and rename at the import site if a local name must differ',
            },
        }),
        type: 'problem',
    },
};
