import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import {
    child,
    childList,
    findProperty,
    identifierName,
    memberPropertyName,
    stringField,
    walk,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { goldenOf } from '../../../kit/project/framework-calls.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

function hasFrozenOption(args: AstNode[]): boolean {
    const frozen = findProperty(args[1], 'frozen');
    const value = child(frozen, 'value');
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
    let current = child(node, 'parent');
    while (current !== undefined) {
        if (current.type === 'CallExpression') {
            const callee = child(current, 'callee');
            // Stryker disable next-line OptionalChaining,ConditionalExpression: a call always has a callee, and only an identifier has a name
            return callee?.type === 'Identifier' && callee.name === 'expect';
        }
        if (!TRANSPARENT_ANCESTORS.has(current.type)) {
            return false;
        }
        current = child(current, 'parent');
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
        // Stryker disable next-line ConditionalExpression,BlockStatement: once found, the walk only spares itself the rest
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
    const parent = child(fn, 'parent');
    // Stryker disable next-line OptionalChaining,ConditionalExpression,BlockStatement: a function always has a parent, and one that is no call has no callee below
    if (parent?.type !== 'CallExpression') {
        return false;
    }
    const callee = child(parent, 'callee');
    // Stryker disable next-line ConditionalExpression,EqualityOperator,BlockStatement: a call always has a callee
    if (callee === undefined) {
        return false;
    }
    const name =
        callee.type === 'Identifier'
            ? (stringField(callee, 'name') ?? '')
            : memberPropertyName(callee);
    return name === 'it' || name === 'test';
}

/** The enclosing function must not be the test callback itself: a test writing a fixture under `TEST_UPDATE` and later asserting a diff holds both halves unrelated. */
function inAThrowingHelper(node: AstNode): boolean {
    let current = child(node, 'parent');
    while (current !== undefined) {
        if (FUNCTION_NODES.has(current.type)) {
            if (isTestCallback(current)) {
                return false;
            }
            const body = child(current, 'body');
            // Stryker disable next-line ConditionalExpression: a function always has a body
            return body !== undefined && assertsAThrow(body);
        }
        current = child(current, 'parent');
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
    const name = memberPropertyName(subject);
    // Stryker disable next-line ConditionalExpression: no name is in the set
    return name !== undefined && RESULT_SUBJECTS.has(name);
}

/** Update mode rewrites a value in place as it rewrites a golden file; a RegExp is a part, and vitest's. */
function inPlaceOf(node: AstNode): boolean {
    const callee = child(node, 'callee');
    if (memberPropertyName(callee ?? node) !== 'toMatch') {
        return false;
    }
    const argument = childList(node, 'arguments')[0];
    // Stryker disable next-line ConditionalExpression: only a literal carries `regex`
    if (argument === undefined || (argument.type === 'Literal' && 'regex' in argument)) {
        return false;
    }
    let expectCall = child(callee, 'object');
    // Stryker disable next-line OptionalChaining: a member always has an object
    while (expectCall?.type === 'MemberExpression') {
        expectCall = child(expectCall, 'object');
    }
    return (
        identifierName(child(expectCall, 'callee')) === 'expect' &&
        isResultSubject(childList(expectCall, 'arguments')[0])
    );
}

const row = rowNamed(consumerRows, 'negative-golden-frozen');

export const negativeGoldenFrozen = defineRule(
    {
        docs: row,
        messages: {
            unfrozenNegativeFixture: {
                found: 'a golden matcher whose mismatch is the subject, with no `{ frozen: true }`',
                fix: 'pass `{ frozen: true }` as its last argument, so `TEST_UPDATE=1` never rewrites the deliberately wrong expectation',
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
                    if (goldenOf(node) === undefined && !inPlaceOf(node)) {
                        return;
                    }
                    if (!isWrappedInExpect(node) && !inAThrowingHelper(node)) {
                        return;
                    }
                    if (hasFrozenOption(childList(node, 'arguments'))) {
                        return;
                    }
                    context.report({ messageId: 'unfrozenNegativeFixture', node });
                },
            };
        },
    },
);
