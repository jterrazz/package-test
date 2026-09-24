import type { Context } from '@oxlint/plugins';

import { memberPropertyName } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** The six constructors, and only six. */
const KNOWN_CONSTRUCTORS = new Set(['api', 'cli', 'integration', 'jobs', 'mobile', 'website']);

/**
 * CONVENTIONS A2 — `specification.api()`, `specification.jobs()`,
 * `specification.cli()`, `specification.integration()`,
 * `specification.website()` and `specification.mobile()` are the only
 * members. Any other access (`specification.app`, `.http`, `.stack`, …) is
 * flagged at the member site. A rendered component has no constructor: it
 * starts nothing, so it is a chain, not a member of this record.
 */
export const a2KnownConstructors: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            MemberExpression(node: AstNode) {
                const object = node.object as AstNode | undefined;
                if (object?.type !== 'Identifier' || object.name !== 'specification') {
                    return;
                }
                const member = memberPropertyName(node);
                if (member !== undefined && !KNOWN_CONSTRUCTORS.has(member)) {
                    context.report({ data: { member }, messageId: 'unknownConstructor', node });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['a2-known-constructors'],
        messages: lessons('a2-known-constructors', {
            unknownConstructor: {
                found: '`specification.{{member}}` is no constructor',
                fix: 'call `specification.api()`, `.jobs()`, `.cli(bin)`, `.integration()`, `.website()` or `.mobile()` — a rendered unit is the `component` chain',
            },
        }),
        type: 'problem',
    },
};
