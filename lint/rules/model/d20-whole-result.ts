import type { Context } from '@oxlint/plugins';

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
} from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** The accessors a result is compared WHOLE through — the subjects this rule counts. */
const WHOLE_SUBJECTS = new Set(['json', 'response']);

/**
 * The names a test binds to what a terminal action resolved to —
 * `const result = await api.get('/users')`: the results it reads.
 */
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

/**
 * Is this read inside a function handed to `expect(…)` — a refusal whose
 * THROW is the subject (`expect(() => result.json.value).toThrow(…)`)? What
 * it reads is never compared, by design.
 */
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

/** `<result>.response` / `<result>.json`, spelled — `undefined` for any other member. */
function accessorOf(node: AstNode, results: ReadonlySet<string>): string | undefined {
    const root = identifierName(child(node, 'object'));
    const property = memberPropertyName(node) ?? '';
    return root !== undefined && results.has(root) && WHOLE_SUBJECTS.has(property)
        ? `${root}.${property}`
        : undefined;
}

/** `<result>.table('<name>')`, spelled — a computed name is out of reach. */
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

/**
 * The subject a node reads, spelled: `result.response`, `result.json`, or
 * `result.table('users')` — `undefined` for anything else.
 */
function subjectOf(node: AstNode, results: ReadonlySet<string>): string | undefined {
    if (node.type === 'MemberExpression') {
        return accessorOf(node, results);
    }
    return node.type === 'CallExpression' ? tableOf(node, results) : undefined;
}

/**
 * The subject an assertion compares WHOLE: `toMatch` handed a value or its
 * golden (a RegExp matches a part), or a table's `toBeEmpty()`.
 */
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

/**
 * CONVENTIONS D20 — every test compares its whole result.
 *
 * A test that reads a response, a json or a table holds ONE comparison of it
 * whole — `expect(result.response).toMatch(…)`, the value written in place or
 * its golden; `await expect(result.table('users')).toMatch([…])` or
 * `toBeEmpty()`. A precise assertion on one property is allowed only IN
 * ADDITION to it: probes alone are a partial oracle, and what they do not name
 * is free to regress unseen. This is D12w's warning grown into the rule it was
 * standing in for — a cluster of body probes is one shape of the defect, a
 * lone one is another.
 *
 * Static and exact within one test: the results are the names a test binds to
 * an awaited terminal action, and a subject is `<result>.response`,
 * `<result>.json` or `<result>.table('<literal>')`. A result read through a
 * helper, a computed table name, or a comparison made in a helper is out of
 * reach — the rule stays silent rather than guess.
 */
export const d20WholeResult: LintRule = {
    create(context: Context): Visitor {
        if (!isTestRole(identityOf(context).role) || !identityOf(context).inSpecs) {
            return {};
        }
        return {
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
                    if (subject !== undefined && !read.has(subject) && !inRefusal(inner)) {
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
        docs: RULE_DOCS['d20-whole-result'],
        messages: lessons('d20-whole-result', {
            partialOracle: {
                found: 'the test reads {{subject}} and never compares it whole',
                fix: 'add ``expect({{subject}}).toMatch(`…`)`` with the whole result in place (`TEST_UPDATE=1` fills an empty one); a precise assertion stays beside it',
            },
        }),
        type: 'problem',
    },
};
