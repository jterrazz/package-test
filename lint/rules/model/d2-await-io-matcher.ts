import { child, childList, goldenOf, identifierName, memberPropertyName } from '../../ast.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, RuleContext } from '../../oxlint-api.js';

/** Matchers backed by IO (SQL query, docker) whatever their argument — must be awaited (D2). */
const IO_MATCHERS = new Set(['toBeEmpty', 'toBeRunning']);

/** The `expect(…)` call a matcher's member chain starts from, through any `.not`. */
function expectCallOf(node: AstNode | undefined): AstNode | undefined {
    let current = node;
    while (current?.type === 'MemberExpression') {
        current = child(current, 'object');
    }
    return identifierName(child(current, 'callee')) === 'expect' ? current : undefined;
}

/** The accessors whose value a list of lists may be — a json, never a table. */
const JSON_SUBJECTS = new Set(['head', 'json', 'jsonLd', 'screen', 'value']);

/** Is this argument rows written in place — a list holding a list? */
function isRowsLiteral(argument: AstNode | undefined): boolean {
    return (
        argument?.type === 'ArrayExpression' &&
        childList(argument, 'elements').some((element) => element.type === 'ArrayExpression')
    );
}

/** What the subject handed to `expect(…)` names: a `.table(…)` read, a json accessor, or neither. */
function subjectKind(subject: AstNode | undefined): 'json' | 'table' | undefined {
    const callee = subject?.type === 'CallExpression' ? child(subject, 'callee') : undefined;
    if (callee !== undefined) {
        return memberPropertyName(callee) === 'table' ? 'table' : undefined;
    }
    const name = subject?.type === 'MemberExpression' ? memberPropertyName(subject) : undefined;
    return name !== undefined && JSON_SUBJECTS.has(name) ? 'json' : undefined;
}

/**
 * Is this `toMatch` a table compared whole — its subject a `.table(…)` read,
 * or its argument rows written in place on a subject no json accessor names?
 * Either way a query answers it.
 */
function comparesTable(node: AstNode): boolean {
    const expectCall = expectCallOf(child(child(node, 'callee'), 'object'));
    const kind = subjectKind(childList(expectCall, 'arguments')[0]);
    return (
        kind === 'table' || (kind === undefined && isRowsLiteral(childList(node, 'arguments')[0]))
    );
}

/** Does the member-call spine root at an `expect(…)` call? */
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

/**
 * The matcher's promise is dropped only when the call is a bare statement
 * (`expect(result.table('users')).toMatch([]);`). Any other position uses the value —
 * awaited, returned, an arrow body, assigned, or passed to an outer
 * `expect(promise).rejects.toThrow(…)` — so the promise is handled.
 */
function isDropped(node: AstNode): boolean {
    const parent = node.parent as AstNode | undefined;
    return parent?.type === 'ExpressionStatement';
}

/**
 * CONVENTIONS D2 — the IO-backed matchers (a table's whole-table `toMatch`
 * runs SQL, `toMatch(directory(…))` walks a tree, `toBeEmpty` queries a table,
 * `toBeRunning` queries docker) return a promise and must be `await`ed (or
 * returned). A bare `expect(result.table('users')).toMatch([…])` silently
 * resolves nothing and the assertion never runs.
 */
export const d2AwaitIoMatcher: LintRule = {
    create(context: RuleContext) {
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
                          : name !== undefined && IO_MATCHERS.has(name)
                            ? `${name}(…)`
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
        messages: {
            mustAwait:
                'expect(…).{{matcher}} is IO-backed and returns a promise — it must be awaited or returned, else the assertion never runs.',
        },
        type: 'problem',
    },
};
