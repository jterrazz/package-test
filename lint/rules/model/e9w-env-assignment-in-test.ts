import type { Context } from '@oxlint/plugins';

import { child, memberPath } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/**
 * Is the target the process environment, or a variable of it?
 *
 * Three spellings write it: a named variable, a computed one, and a
 * replacement of the whole object (spread into a fresh one), which outlasts
 * the test exactly as the other two do.
 */
function isEnvTarget(node: AstNode | undefined): boolean {
    if (memberPath(node) === 'process.env') {
        return true;
    }
    if (node?.type !== 'MemberExpression') {
        return false;
    }
    return memberPath(child(node, 'object')) === 'process.env';
}

/**
 * CONVENTIONS E9w (warning) — a raw assignment onto the process environment
 * in a test.
 *
 * The assignment outlasts the test: the next file in the same worker inherits
 * it, and the failure lands somewhere else. `vi.stubEnv` restores itself at the
 * end of the test, and a default a binary always needs belongs to
 * `specification.cli({ defaults })` where every run can see it.
 *
 * A warning rather than an error: a test whose subject IS the process
 * environment legitimately writes to it, and says so in a line.
 */
export const e9wEnvAssignmentInTest: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => isTestRole(identityOf(context).role),
            AssignmentExpression(node: AstNode) {
                if (isEnvTarget(child(node, 'left'))) {
                    context.report({ messageId: 'rawAssignment', node });
                }
            },
            // Deleting a variable of the environment is a write too: it is
            // Gone for every file the worker runs afterwards.
            UnaryExpression(node: AstNode) {
                if (node.operator === 'delete' && isEnvTarget(child(node, 'argument'))) {
                    context.report({ messageId: 'rawAssignment', node });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['e9w-env-assignment-in-test'],
        messages: lessons('e9w-env-assignment-in-test', {
            rawAssignment: {
                found: 'the test writes the process environment directly',
                fix: "write `vi.stubEnv('<NAME>', '<value>')`, which restores itself; a CLI default belongs to `specification.cli({ defaults })`",
            },
        }),
        type: 'suggestion',
    },
};
