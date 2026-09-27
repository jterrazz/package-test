import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { child, identifierName } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isTestRole } from '../../../engine/project/role.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const BUILDERS = new Set(['beforeAll', 'beforeEach']);

const row = rowNamed(consumerRows, 'given-in-the-test');

export const givenInTheTest = defineRule(
    {
        docs: row,
        messages: {
            givenInAHook: {
                found: '`{{hook}}` moves the Given out of the tests',
                fix: 'write the Given in each test — a shared value is a function each test calls, and `clock.at()` restores itself',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'suggestion',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                before: () => isTestRole(identityOf(context).role),
                CallExpression(node: AstNode) {
                    const name = identifierName(child(node, 'callee'));
                    if (name !== undefined && BUILDERS.has(name)) {
                        context.report({ data: { hook: name }, messageId: 'givenInAHook', node });
                    }
                },
            };
        },
    },
);
