import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, identifierName, memberPropertyName } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

const LOOPS: ReadonlySet<string> = new Set([
    'DoWhileStatement',
    'ForInStatement',
    'ForOfStatement',
    'ForStatement',
    'WhileStatement',
]);

const FUNCTIONS: ReadonlySet<string> = new Set([
    'ArrowFunctionExpression',
    'FunctionDeclaration',
    'FunctionExpression',
]);

function isExpectCall(node: AstNode): boolean {
    const callee = child(node, 'callee');
    const root = callee?.type === 'MemberExpression' ? child(callee, 'object') : callee;
    return identifierName(root) === 'expect';
}

const ITERATIONS: ReadonlySet<string> = new Set([
    'every',
    'filter',
    'find',
    'flatMap',
    'forEach',
    'map',
    'reduce',
    'some',
]);

function iterationOf(fn: AstNode): string | undefined {
    const call = child(fn, 'parent');
    const callee = child(call, 'callee');
    const method =
        call?.type === 'CallExpression' && callee !== undefined
            ? memberPropertyName(callee)
            : undefined;
    return method !== undefined && ITERATIONS.has(method) ? `\`${method}\` callback` : undefined;
}

function loopAround(node: AstNode): string | undefined {
    let current = child(node, 'parent');
    while (current !== undefined) {
        if (LOOPS.has(current.type)) {
            return current.type === 'ForOfStatement' ? 'for…of' : 'loop';
        }
        if (FUNCTIONS.has(current.type)) {
            return iterationOf(current);
        }
        current = child(current, 'parent');
    }
    return undefined;
}

const row = rowNamed(consumerRows, 'no-expect-in-a-loop');

export const noExpectInALoop = defineRule(
    {
        docs: row,
        messages: {
            expectInALoop: {
                found: '`expect()` inside a {{loop}}, which runs it once per element — and not at all over none',
                fix: 'compare the whole collection in one assertion — `expect(rows.map(…)).toStrictEqual([…])` — or state each case with `test.each`',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                before: () => isTestRole(identityOf(context).role),
                CallExpression(node: AstNode) {
                    if (!isExpectCall(node)) {
                        return;
                    }
                    const loop = loopAround(node);
                    if (loop !== undefined) {
                        context.report({ data: { loop }, messageId: 'expectInALoop', node });
                    }
                },
            };
        },
    },
);
