import type { Context } from '@oxlint/plugins';

import { lessons } from '../../catalogue/lesson.js';
import { RULE_DOCS } from '../../catalogue/manifest.js';
import {
    child,
    childList,
    goldenOf,
    identifierName,
    memberPropertyName,
} from '../../reading/ast.js';
import type { AstNode } from '../../reading/ast.js';
import type { LintRule, Visitor } from '../rule.js';

function expectCallOf(node: AstNode | undefined): AstNode | undefined {
    let current = node;
    while (current?.type === 'MemberExpression') {
        current = child(current, 'object');
    }
    return identifierName(child(current, 'callee')) === 'expect' ? current : undefined;
}

const JSON_SUBJECTS = new Set(['head', 'json', 'jsonLd', 'screen', 'value']);

function isRowsLiteral(argument: AstNode | undefined): boolean {
    return (
        argument?.type === 'ArrayExpression' &&
        childList(argument, 'elements').some((element) => element.type === 'ArrayExpression')
    );
}

function subjectKind(subject: AstNode | undefined): 'json' | 'table' | undefined {
    const callee = subject?.type === 'CallExpression' ? child(subject, 'callee') : undefined;
    if (callee !== undefined) {
        return memberPropertyName(callee) === 'table' ? 'table' : undefined;
    }
    const name = subject?.type === 'MemberExpression' ? memberPropertyName(subject) : undefined;
    return name !== undefined && JSON_SUBJECTS.has(name) ? 'json' : undefined;
}

/** Either way a query answers it. */
function comparesTable(node: AstNode): boolean {
    const expectCall = expectCallOf(child(child(node, 'callee'), 'object'));
    const kind = subjectKind(childList(expectCall, 'arguments')[0]);
    return (
        kind === 'table' || (kind === undefined && isRowsLiteral(childList(node, 'arguments')[0]))
    );
}

function rootsAtExpect(node: AstNode | undefined): boolean {
    let current = node;
    while (current !== undefined) {
        if (current.type === 'CallExpression') {
            const callee = current.callee as AstNode | undefined;
            if (callee?.type === 'Identifier' && callee.name === 'expect') {
                return true;
            }
            current = callee;
        } else if (current.type === 'MemberExpression') {
            current = current.object as AstNode | undefined;
        } else {
            return false;
        }
    }
    return false;
}

/** Dropped only as a bare statement: awaited, returned, assigned or handed to an outer `expect(…).rejects` is handled. */
function isDropped(node: AstNode): boolean {
    const parent = node.parent as AstNode | undefined;
    return parent?.type === 'ExpressionStatement';
}

/** `toBeEmpty` and `toBeRunning` are typed `Promise<void>`, so `typescript/no-floating-promises` refuses them dropped; `toMatch`'s type follows its subject, so it stays here. */
export const d2AwaitIoMatcher: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            CallExpression(node: AstNode) {
                const callee = node.callee as AstNode | undefined;
                if (callee === undefined) {
                    return;
                }
                const name = memberPropertyName(callee);
                const matcher =
                    goldenOf(node)?.kind === 'directory'
                        ? 'toMatch(directory(…))'
                        : name === 'toMatch' && comparesTable(node)
                          ? 'toMatch(<rows>)'
                          : undefined;
                if (matcher === undefined) {
                    return;
                }
                if (!rootsAtExpect(callee.object as AstNode | undefined)) {
                    return;
                }
                if (isDropped(node)) {
                    context.report({ data: { matcher }, messageId: 'mustAwait', node });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['d2-await-io-matcher'],
        messages: lessons('d2-await-io-matcher', {
            mustAwait: {
                found: '`expect(…).{{matcher}}` not awaited — it returns a promise',
                fix: 'write `await expect(…).{{matcher}}(…)`, or return it',
            },
        }),
        type: 'problem',
    },
};
