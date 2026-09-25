import type { Context } from '@oxlint/plugins';

import { child, memberPath } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** A replacement of the whole object outlasts the test exactly as a variable does. */
function isEnvTarget(node: AstNode | undefined): boolean {
    if (memberPath(node) === 'process.env') {
        return true;
    }
    if (node?.type !== 'MemberExpression') {
        return false;
    }
    return memberPath(child(node, 'object')) === 'process.env';
}

/** A warning: a test whose subject is the process environment writes to it, and says so in a line. */
export const e9wEnvAssignmentInTest: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => isTestRole(identityOf(context).role),
            AssignmentExpression(node: AstNode) {
                if (isEnvTarget(child(node, 'left'))) {
                    context.report({ messageId: 'rawAssignment', node });
                }
            },
            // A deletion is a write too: it is gone for every later file of the worker.
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
