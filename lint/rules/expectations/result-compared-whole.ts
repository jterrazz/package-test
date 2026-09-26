import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import {
    assertionOf,
    child,
    childList,
    findTestCallback,
    identifierName,
    isTestCallee,
    memberPropertyName,
    stringValue,
    walk,
} from '../../reading/ast.js';
import type { AstNode } from '../../reading/ast.js';
import { identityOf } from '../../reading/linted-file.js';
import { isTestRole } from '../../reading/role.js';
import type { LintRule, Visitor } from '../rule.js';
import { isCarried } from './result-compared-whole.carried.js';

const WHOLE_SUBJECTS = new Set(['json', 'response']);

/** `const result = await api.get('/users')`. */
function resultNames(body: AstNode): Set<string> {
    const names = new Set<string>();
    const collect = (node: AstNode): void => {
        const name =
            node.type === 'VariableDeclarator' ? identifierName(child(node, 'id')) : undefined;
        if (name !== undefined && child(node, 'init')?.type === 'AwaitExpression') {
            names.add(name);
        }
    };
    walk(body, collect);
    return names;
}

/** A refusal whose throw is the subject (`expect(() => result.json.value).toThrow(…)`) never compares what it reads. */
function inRefusal(node: AstNode): boolean {
    let current = child(node, 'parent');
    while (current !== undefined) {
        const holder = child(current, 'parent');
        if (
            (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') &&
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
    const property = memberPropertyName(node) ?? '';
    return root !== undefined && results.has(root) && WHOLE_SUBJECTS.has(property)
        ? `${root}.${property}`
        : undefined;
}

/** A computed name is out of reach. */
function tableOf(node: AstNode, results: ReadonlySet<string>): string | undefined {
    const callee = child(node, 'callee');
    if (callee?.type !== 'MemberExpression' || memberPropertyName(callee) !== 'table') {
        return undefined;
    }
    const root = identifierName(child(callee, 'object'));
    const table = stringValue(childList(node, 'arguments')[0]);
    return root !== undefined && results.has(root) && table !== undefined
        ? `${root}.table('${table}')`
        : undefined;
}

function subjectOf(node: AstNode, results: ReadonlySet<string>): string | undefined {
    if (node.type === 'MemberExpression') {
        return accessorOf(node, results);
    }
    return node.type === 'CallExpression' ? tableOf(node, results) : undefined;
}

/** A RegExp matches a part. */
function wholeComparisonOf(node: AstNode, results: ReadonlySet<string>): string | undefined {
    const assertion = assertionOf(node);
    if (assertion?.subject === undefined || assertion.modifiers.includes('not')) {
        return undefined;
    }
    const [argument] = childList(node, 'arguments');
    const whole =
        (assertion.matcher === 'toMatch' &&
            argument !== undefined &&
            !(argument.type === 'Literal' && 'regex' in argument)) ||
        assertion.matcher === 'toBeEmpty';
    return whole ? subjectOf(assertion.subject, results) : undefined;
}

/** Static and exact within one test: a result read through a helper or a computed table name is out of reach, and the rule stays silent rather than guess. A carried read (`carried.ts`) owes no comparison. */
export const resultComparedWhole: LintRule = {
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
                    if (whole !== undefined) {
                        compared.add(whole);
                    }
                });
                for (const [subject, at] of read) {
                    if (!compared.has(subject)) {
                        context.report({ data: { subject }, messageId: 'partialOracle', node: at });
                    }
                }
            },
        };
    },
    meta: {
        docs: rowOf('result-compared-whole'),
        messages: lessons('result-compared-whole', {
            partialOracle: {
                found: 'the test reads {{subject}} and never compares it whole',
                fix: 'add ``expect({{subject}}).toMatch(`…`)`` with the whole result in place (`TEST_UPDATE=1` fills an empty one); a precise assertion stays beside it',
            },
        }),
        type: 'problem',
    },
};
