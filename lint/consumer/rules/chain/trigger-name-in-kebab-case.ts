import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { memberPropertyName, stringValue } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { toKebabCase } from '../../../kit/project/record-key.js';
import { consumerRows } from '../../catalogue/manifest.js';

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function kebabOf(name: string): string {
    return toKebabCase(name)
        .replaceAll(/[^a-z0-9]+/gu, '-')
        .replaceAll(/^-|-$/gu, '');
}

const row = rowNamed(consumerRows, 'trigger-name-in-kebab-case');

/** Only string literals are checked: a dynamic name is out of static reach. */
export const triggerNameInKebabCase = defineRule(
    {
        docs: row,
        messages: {
            notKebab: {
                found: 'the job name "{{name}}" is not kebab-case',
                fix: 'rename the job "{{kebab}}", in the app and in its tests alike',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                CallExpression(node: AstNode) {
                    const callee = node.callee as AstNode | undefined;
                    if (callee === undefined || memberPropertyName(callee) !== 'trigger') {
                        return;
                    }
                    const [first] = (node.arguments as AstNode[] | undefined) ?? [];
                    const name = stringValue(first);
                    if (first !== undefined && name !== undefined && !KEBAB_CASE.test(name)) {
                        context.report({
                            data: { kebab: kebabOf(name), name },
                            messageId: 'notKebab',
                            node: first,
                        });
                    }
                },
            };
        },
    },
);
