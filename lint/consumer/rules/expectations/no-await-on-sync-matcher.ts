import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import { memberPropertyName } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const SYNC_MATCHERS = new Set(['toBe', 'toContain', 'toEqual', 'toHaveLength']);

/** `.resolves`/`.rejects` make a sync matcher async, so that await is not redundant. */
function rootsAtSyncExpect(node: AstNode | undefined): boolean {
    let current = node;
    while (current !== undefined) {
        if (current.type === 'CallExpression') {
            const callee = current.callee as AstNode | undefined;
            if (callee?.type === 'Identifier' && callee.name === 'expect') {
                return true;
            }
            current = callee;
        } else if (current.type === 'MemberExpression') {
            const property = memberPropertyName(current);
            if (property === 'resolves' || property === 'rejects') {
                return false;
            }
            current = current.object as AstNode | undefined;
        } else {
            return false;
        }
    }
    return false;
}

export const noAwaitOnSyncMatcher: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            CallExpression(node: AstNode) {
                const parent = node.parent as AstNode | undefined;
                if (parent?.type !== 'AwaitExpression') {
                    return;
                }
                const callee = node.callee as AstNode | undefined;
                if (callee === undefined) {
                    return;
                }
                const matcher = memberPropertyName(callee);
                if (matcher === undefined || !SYNC_MATCHERS.has(matcher)) {
                    return;
                }
                if (rootsAtSyncExpect(callee.object as AstNode | undefined)) {
                    context.report({ data: { matcher }, messageId: 'redundantAwait', node });
                }
            },
        };
    },
    meta: {
        docs: rowNamed(consumerRows, 'no-await-on-sync-matcher'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'no-await-on-sync-matcher'),
            {
                redundantAwait: {
                    found: '`await` on the synchronous `expect(…).{{matcher}}(…)`',
                    fix: 'delete the `await`; only an IO matcher is awaited — a table compared whole, `toMatch(directory(…))`, `toBeEmpty`, `toBeRunning`',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'suggestion',
    },
};
