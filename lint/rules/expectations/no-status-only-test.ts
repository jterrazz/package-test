import type { Context } from '@oxlint/plugins';

import { lessons } from '../../catalogue/lesson.js';
import { RULE_DOCS } from '../../catalogue/manifest.js';
import { findTestCallback, isTestCallee, memberPropertyName, walk } from '../../reading/ast.js';
import type { AstNode } from '../../reading/ast.js';
import { identityOf } from '../../reading/linted-file.js';
import { isTestRole } from '../../reading/role.js';
import type { LintRule, Visitor } from '../rule.js';

const MIN_STATUS = 100;
const MAX_STATUS = 599;

const EQUALITY_MATCHERS = new Set(['toBe', 'toEqual']);

function isExpectCall(node: AstNode | undefined): boolean {
    if (node?.type !== 'CallExpression') {
        return false;
    }
    const callee = node.callee as AstNode | undefined;
    return callee?.type === 'Identifier' && callee.name === 'expect';
}

function isStatusLiteral(node: AstNode | undefined): boolean {
    if (node?.type !== 'Literal' || typeof node.value !== 'number') {
        return false;
    }
    const { value } = node;
    return Number.isInteger(value) && value >= MIN_STATUS && value <= MAX_STATUS;
}

/** The numeric gate keeps container-status strings (`expect(neo.status).toBe('running')`) out. */
function isStatusProbe(node: AstNode): boolean {
    if (node.type !== 'CallExpression') {
        return false;
    }
    const callee = node.callee as AstNode | undefined;
    if (callee?.type !== 'MemberExpression') {
        return false;
    }
    const matcher = memberPropertyName(callee);
    if (matcher === undefined || !EQUALITY_MATCHERS.has(matcher)) {
        return false;
    }
    const expectCall = callee.object as AstNode | undefined;
    if (!isExpectCall(expectCall)) {
        return false;
    }
    const subject = ((expectCall?.arguments as AstNode[] | undefined) ?? [])[0];
    if (subject?.type !== 'MemberExpression' || memberPropertyName(subject) !== 'status') {
        return false;
    }
    const expected = ((node.arguments as AstNode[] | undefined) ?? [])[0];
    return isStatusLiteral(expected);
}

/** Fires only when every `expect(…)` of the callback is a status probe: one beside a real assertion is the scalpel, and d12w needs a cluster of three. */
export const d15wStatusOnlyProbe: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => isTestRole(identityOf(context).role),
            CallExpression(node: AstNode) {
                if (!isTestCallee(node.callee as AstNode | undefined)) {
                    return;
                }
                const callback = findTestCallback((node.arguments as AstNode[] | undefined) ?? []);
                if (callback === undefined) {
                    return;
                }

                let expectCalls = 0;
                let statusProbes = 0;
                walk(callback, (inner) => {
                    if (isExpectCall(inner)) {
                        expectCalls++;
                    }
                    if (isStatusProbe(inner)) {
                        statusProbes++;
                    }
                });

                if (expectCalls >= 1 && statusProbes === expectCalls) {
                    context.report({ messageId: 'statusOnlyProbe', node });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['d15w-status-only-probe'],
        messages: lessons('d15w-status-only-probe', {
            statusOnlyProbe: {
                found: "the test's only assertions probe the HTTP status",
                fix: 'compare the whole response, ``expect(result.response).toMatch(`HTTP/1.1 …`)`` (`TEST_UPDATE=1` fills an empty one), and keep the status probe beside it only if the status is the point',
            },
        }),
        type: 'suggestion',
    },
};
