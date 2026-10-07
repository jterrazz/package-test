import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { assertionOf } from '../../../kit/project/assertions.js';
import {
    child,
    childList,
    identifierName,
    memberPropertyName,
    stringValue,
    walk,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { findTestCallback, isTestCallee } from '../../../kit/project/test-calls.js';
import { consumerRows } from '../../catalogue/manifest.js';
import { isCarried } from './result-compared-whole.carried.js';

const WHOLE_SUBJECTS = new Set(['json', 'response']);

function resultNames(body: AstNode): Set<string> {
    const names = new Set<string>();
    const collect = (node: AstNode): void => {
        // Stryker disable ConditionalExpression: only a declarator holds an `init` the next line reads
        const name =
            node.type === 'VariableDeclarator' ? identifierName(child(node, 'id')) : undefined;
        // Stryker restore ConditionalExpression
        // Stryker disable next-line ConditionalExpression,OptionalChaining: a declarator with no name or no value is no result
        if (name !== undefined && child(node, 'init')?.type === 'AwaitExpression') {
            names.add(name);
        }
    };
    walk(body, collect);
    return names;
}

// invariant: a refusal whose throw is the subject (`expect(() => result.json.value).toThrow(…)`) never compares what it reads.
function inRefusal(node: AstNode): boolean {
    let current = child(node, 'parent');
    while (current !== undefined) {
        const holder = child(current, 'parent');
        if (
            (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') &&
            // Stryker disable next-line OptionalChaining,ConditionalExpression: only the program has no parent, and only a call has a callee
            holder?.type === 'CallExpression' &&
            identifierName(child(holder, 'callee')) === 'expect'
        ) {
            return true;
        }
        current = holder;
    }
    return false;
}

function accessorOf(node: AstNode, results: ReadonlySet<string>): string | undefined {
    const root = identifierName(child(node, 'object'));
    // Stryker disable next-line StringLiteral: no whole subject is named by the text standing for an unnamed member
    const property = memberPropertyName(node) ?? '';
    // Stryker disable next-line ConditionalExpression: no name is a result
    return root !== undefined && results.has(root) && WHOLE_SUBJECTS.has(property)
        ? `${root}.${property}`
        : undefined;
}

// invariant: a computed name is out of reach.
function tableOf(node: AstNode, results: ReadonlySet<string>): string | undefined {
    const callee = child(node, 'callee');
    // Stryker disable next-line ConditionalExpression,OptionalChaining: memberPropertyName reads no name from a non-member
    if (callee?.type !== 'MemberExpression' || memberPropertyName(callee) !== 'table') {
        return undefined;
    }
    const root = identifierName(child(callee, 'object'));
    const table = stringValue(childList(node, 'arguments')[0]);
    // Stryker disable next-line ConditionalExpression: no name is a result
    return root !== undefined && results.has(root) && table !== undefined
        ? `${root}.table('${table}')`
        : undefined;
}

function subjectOf(node: AstNode, results: ReadonlySet<string>): string | undefined {
    if (node.type === 'MemberExpression') {
        return accessorOf(node, results);
    }
    // Stryker disable next-line ConditionalExpression: a node that is no call has no `table` callee
    return node.type === 'CallExpression' ? tableOf(node, results) : undefined;
}

// invariant: a RegExp matches a part.
function wholeComparisonOf(node: AstNode, results: ReadonlySet<string>): string | undefined {
    const assertion = assertionOf(node);
    if (assertion?.subject === undefined || assertion.modifiers.includes('not')) {
        return undefined;
    }
    const [argument] = childList(node, 'arguments');
    const whole =
        (assertion.matcher === 'toMatch' &&
            argument !== undefined &&
            // Stryker disable next-line ConditionalExpression: only a literal carries `regex`
            !(argument.type === 'Literal' && 'regex' in argument)) ||
        assertion.matcher === 'toBeEmpty';
    return whole ? subjectOf(assertion.subject, results) : undefined;
}

const row = rowNamed(consumerRows, 'result-compared-whole');

/** Static and exact within one test: a result read through a helper or a computed table name is out of reach, and the rule stays silent rather than guess. A carried read (`carried.ts`) owes no comparison. */
export const resultComparedWhole = defineRule(
    {
        docs: row,
        messages: {
            partialOracle: {
                found: 'the test reads {{subject}} and never compares it whole',
                fix: 'add ``expect({{subject}}).toMatch(`…`)`` with the whole result in place (`TEST_UPDATE=1` fills an empty one); a precise assertion stays beside it',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                before: () => isTestRole(identityOf(context).role) && identityOf(context).inSpecs,
                CallExpression(node: AstNode) {
                    if (!isTestCallee(child(node, 'callee'))) {
                        return;
                    }
                    const callback = findTestCallback(childList(node, 'arguments'));
                    if (callback === undefined) {
                        return;
                    }
                    const results = resultNames(callback);
                    const read = new Map<string, AstNode>();
                    const compared = new Set<string>();
                    walk(callback, (inner) => {
                        const subject = subjectOf(inner, results);
                        if (
                            subject !== undefined &&
                            !read.has(subject) &&
                            !inRefusal(inner) &&
                            !isCarried(inner, callback, results)
                        ) {
                            read.set(subject, inner);
                        }
                        const whole = wholeComparisonOf(inner, results);
                        // Stryker disable next-line ConditionalExpression: no comparison is no subject read
                        if (whole !== undefined) {
                            compared.add(whole);
                        }
                    });
                    for (const [subject, at] of read) {
                        if (!compared.has(subject)) {
                            context.report({
                                data: { subject },
                                messageId: 'partialOracle',
                                node: at,
                            });
                        }
                    }
                },
            };
        },
    },
);
