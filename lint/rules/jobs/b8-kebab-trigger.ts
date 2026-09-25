import type { Context } from '@oxlint/plugins';

import { toKebabCase } from '../../../src/model/services/binding.js';
import { memberPropertyName, stringValue } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** Stable kebab-case job identifier: `nightly-report`, `send-welcome-emails`. */
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** The kebab-case spelling of a job name: its words, lowercased, joined by `-`. */
function kebabOf(name: string): string {
    return toKebabCase(name)
        .replaceAll(/[^a-z0-9]+/gu, '-')
        .replaceAll(/^-|-$/gu, '');
}

/**
 * CONVENTIONS B8 — a job `name` passed to `.trigger()` is a stable kebab-case
 * identifier; it is a contract between the app and its tests. Only string
 * literals are checked — dynamic names are out of static reach.
 */
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
