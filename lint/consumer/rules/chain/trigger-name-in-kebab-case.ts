import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import { memberPropertyName, stringValue } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { toKebabCase } from '../../../engine/project/record-key.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { consumerRows } from '../../catalogue/manifest.js';

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function kebabOf(name: string): string {
    return toKebabCase(name)
        .replaceAll(/[^a-z0-9]+/gu, '-')
        .replaceAll(/^-|-$/gu, '');
}

/** Only string literals are checked: a dynamic name is out of static reach. */
export const triggerNameInKebabCase: LintRule = {
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
    meta: {
        docs: rowNamed(consumerRows, 'trigger-name-in-kebab-case'),
        messages: lessonsAt(rowNamed(consumerRows, 'trigger-name-in-kebab-case'), {
            notKebab: {
                found: 'the job name "{{name}}" is not kebab-case',
                fix: 'rename the job "{{kebab}}", in the app and in its tests alike',
            },
        }),
        type: 'problem',
    },
};
