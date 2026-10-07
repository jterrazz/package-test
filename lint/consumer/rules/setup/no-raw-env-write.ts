import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, memberPath } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

// invariant: a replacement of the whole object outlasts the test exactly as a variable does.
function isEnvTarget(node: AstNode | undefined): boolean {
    if (memberPath(node) === 'process.env') {
        return true;
    }
    // Stryker disable next-line ConditionalExpression,OptionalChaining,BlockStatement: what is written always exists, and only a member has an object
    if (node?.type !== 'MemberExpression') {
        return false;
    }
    return memberPath(child(node, 'object')) === 'process.env';
}

const row = rowNamed(consumerRows, 'no-raw-env-write');

export const noRawEnvWrite = defineRule(
    {
        docs: row,
        messages: {
            rawAssignment: {
                found: 'the test writes the process environment directly',
                fix: "write `vi.stubEnv('<NAME>', '<value>')`, which restores itself; a CLI default belongs to `specification.cli({ defaults })`",
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'suggestion',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                before: () => isTestRole(identityOf(context).role),
                AssignmentExpression(node: AstNode) {
                    if (isEnvTarget(child(node, 'left'))) {
                        context.report({ messageId: 'rawAssignment', node });
                    }
                },
                // invariant: a deletion is a write too: it is gone for every later file of the worker.
                UnaryExpression(node: AstNode) {
                    if (node.operator === 'delete' && isEnvTarget(child(node, 'argument'))) {
                        context.report({ messageId: 'rawAssignment', node });
                    }
                },
            };
        },
    },
);
