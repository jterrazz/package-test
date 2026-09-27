import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import { child, memberPath } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isTestRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

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
        docs: rowNamed(consumerRows, 'no-raw-env-write'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'no-raw-env-write'),
            {
                rawAssignment: {
                    found: 'the test writes the process environment directly',
                    fix: "write `vi.stubEnv('<NAME>', '<value>')`, which restores itself; a CLI default belongs to `specification.cli({ defaults })`",
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'suggestion',
    },
};
