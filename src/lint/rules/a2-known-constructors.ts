import { memberPropertyName } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext } from '../types.js';

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
    create(context: RuleContext) {
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
        messages: {
            unknownConstructor:
                'specification.{{member}} does not exist — the only constructors are specification.api(), specification.jobs(), specification.cli(), specification.integration(), specification.website() and specification.mobile().',
        },
        type: 'problem',
    },
};
