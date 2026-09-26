import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import {
    child,
    childList,
    findProperty,
    goldenOf,
    identifierName,
    memberPropertyName,
    walk,
} from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isTestRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { consumerRows } from '../../catalogue/manifest.js';

function hasFrozenOption(args: AstNode[]): boolean {
    const options = args[1];
    if (options?.type !== 'ObjectExpression') {
        return false;
    }
    const frozen = findProperty(options, 'frozen');
    const value = frozen?.value as AstNode | undefined;
    return value?.type === 'Literal' && value.value === true;
}

/** The walk stops at the first statement boundary or non-`expect` call, so a `toMatch` written inside `inUpdateMode(() => …)` is not flagged. */
const TRANSPARENT_ANCESTORS = new Set([
    'ArrowFunctionExpression',
    'AwaitExpression',
    'ChainExpression',
    'MemberExpression',
    'ParenthesizedExpression',
    'TSAsExpression',
    'TSNonNullExpression',
]);

function isWrappedInExpect(node: AstNode): boolean {
    let current = node.parent as AstNode | undefined;
    while (current !== undefined) {
        if (current.type === 'CallExpression') {
            const callee = current.callee as AstNode | undefined;
            return callee?.type === 'Identifier' && callee.name === 'expect';
        }
        if (!TRANSPARENT_ANCESTORS.has(current.type)) {
            return false;
        }
        current = current.parent as AstNode | undefined;
    }
    return false;
}

/** Under `TEST_UPDATE=1` an unfrozen fixture is rewritten instead of throwing, which destroys the negative case. */
const FUNCTION_NODES = new Set([
    'ArrowFunctionExpression',
    'FunctionDeclaration',
    'FunctionExpression',
]);

function assertsAThrow(body: AstNode): boolean {
    let found = false;
    walk(body, (inner: AstNode) => {
        if (found) {
            return;
        }
        const name = memberPropertyName(inner);
        if (name === 'toThrow' || name === 'toThrowError' || name === 'rejects') {
            found = true;
        }
    });
    return found;
}

function isTestCallback(fn: AstNode): boolean {
    const parent = fn.parent as AstNode | undefined;
    if (parent?.type !== 'CallExpression') {
        return false;
    }
    const callee = parent.callee as AstNode | undefined;
    if (callee === undefined) {
        return false;
    }
    const name =
        callee.type === 'Identifier' ? (callee.name as string) : memberPropertyName(callee);
    return name === 'it' || name === 'test';
}

/** The enclosing function must not be the test callback itself: a test writing a fixture under `TEST_UPDATE` and later asserting a diff holds both halves unrelated. */
function inAThrowingHelper(node: AstNode): boolean {
    let current = node.parent as AstNode | undefined;
    while (current !== undefined) {
        if (FUNCTION_NODES.has(current.type)) {
            if (isTestCallback(current)) {
                return false;
            }
            const body = current.body as AstNode | undefined;
            return body !== undefined && assertsAThrow(body);
        }
        current = current.parent as AstNode | undefined;
    }
    return false;
}

const RESULT_SUBJECTS = new Set([
    'body',
    'console',
    'content',
    'error',
    'errors',
    'head',
    'html',
    'json',
    'jsonLd',
    'response',
    'screen',
    'stderr',
    'stdout',
    'title',
    'tree',
    'value',
]);

function isResultSubject(subject: AstNode | undefined): boolean {
    if (subject?.type === 'CallExpression') {
        const callee = child(subject, 'callee');
        return (
            identifierName(callee) === 'text' || memberPropertyName(callee ?? subject) === 'table'
        );
    }
    const name = subject?.type === 'MemberExpression' ? memberPropertyName(subject) : undefined;
    return name !== undefined && RESULT_SUBJECTS.has(name);
}

/** Update mode rewrites a value in place as it rewrites a golden file; a RegExp is a part, and vitest's. */
function inPlaceOf(node: AstNode): boolean {
    const callee = child(node, 'callee');
    if (memberPropertyName(callee ?? node) !== 'toMatch') {
        return false;
    }
    const argument = childList(node, 'arguments')[0];
    if (argument === undefined || (argument.type === 'Literal' && 'regex' in argument)) {
        return false;
    }
    let expectCall = child(callee, 'object');
    while (expectCall?.type === 'MemberExpression') {
        expectCall = child(expectCall, 'object');
    }
    return (
        identifierName(child(expectCall, 'callee')) === 'expect' &&
        isResultSubject(childList(expectCall, 'arguments')[0])
    );
}

export const negativeGoldenFrozen: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => isTestRole(identityOf(context).role),
            CallExpression(node: AstNode) {
                if (goldenOf(node) === undefined && !inPlaceOf(node)) {
                    return;
                }
                if (!isWrappedInExpect(node) && !inAThrowingHelper(node)) {
                    return;
                }
                if (hasFrozenOption((node.arguments as AstNode[] | undefined) ?? [])) {
                    return;
                }
                context.report({ messageId: 'unfrozenNegativeFixture', node });
            },
        };
    },
    meta: {
        docs: rowNamed(consumerRows, 'negative-golden-frozen'),
        messages: lessonsAt(rowNamed(consumerRows, 'negative-golden-frozen'), {
            unfrozenNegativeFixture: {
                found: 'a golden matcher whose mismatch is the subject, with no `{ frozen: true }`',
                fix: 'pass `{ frozen: true }` as its last argument, so `TEST_UPDATE=1` never rewrites the deliberately wrong expectation',
            },
        }),
        type: 'suggestion',
    },
};
