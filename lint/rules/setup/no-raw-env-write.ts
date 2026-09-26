import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import { child, memberPath } from '../../reading/ast.js';
import type { AstNode, Visitor } from '../../reading/ast.js';
import { identityOf } from '../../reading/linted-file.js';
import { isTestRole } from '../../reading/role.js';
import type { LintRule } from '../rule.js';

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
export const noRawEnvWrite: LintRule = {
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
        docs: rowOf('no-raw-env-write'),
        messages: lessons('no-raw-env-write', {
            rawAssignment: {
                found: 'the test writes the process environment directly',
                fix: "write `vi.stubEnv('<NAME>', '<value>')`, which restores itself; a CLI default belongs to `specification.cli({ defaults })`",
            },
        }),
        type: 'suggestion',
    },
};
