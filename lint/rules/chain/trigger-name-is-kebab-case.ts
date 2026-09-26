import type { Context } from '@oxlint/plugins';

import { toKebabCase } from '../../../src/world/services/record-key.js';
import { lessons } from '../../catalogue/lesson.js';
import { RULE_DOCS } from '../../catalogue/manifest.js';
import { memberPropertyName, stringValue } from '../../reading/ast.js';
import type { AstNode } from '../../reading/ast.js';
import type { LintRule, Visitor } from '../rule.js';

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function kebabOf(name: string): string {
    return toKebabCase(name)
        .replaceAll(/[^a-z0-9]+/gu, '-')
        .replaceAll(/^-|-$/gu, '');
}

/** Only string literals are checked: a dynamic name is out of static reach. */
export const b8KebabTrigger: LintRule = {
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
        docs: RULE_DOCS['b8-kebab-trigger'],
        messages: lessons('b8-kebab-trigger', {
            notKebab: {
                found: 'the job name "{{name}}" is not kebab-case',
                fix: 'rename the job "{{kebab}}", in the app and in its tests alike',
            },
        }),
        type: 'problem',
    },
};
