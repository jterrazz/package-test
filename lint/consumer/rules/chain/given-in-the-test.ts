import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import { child, identifierName } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isTestRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const BUILDERS = new Set(['beforeAll', 'beforeEach']);

export const givenInTheTest: LintRule = {
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
    meta: {
        docs: rowNamed(consumerRows, 'given-in-the-test'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'given-in-the-test'),
            {
                givenInAHook: {
                    found: '`{{hook}}` moves the Given out of the tests',
                    fix: 'write the Given in each test — a shared value is a function each test calls, and `clock.at()` restores itself',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'suggestion',
    },
};
