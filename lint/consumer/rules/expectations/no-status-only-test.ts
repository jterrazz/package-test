import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import {
    child,
    childList,
    findTestCallback,
    isTestCallee,
    memberPropertyName,
    walk,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

const MIN_STATUS = 100;
const MAX_STATUS = 599;

const EQUALITY_MATCHERS = new Set(['toBe', 'toEqual']);

function isExpectCall(node: AstNode | undefined): boolean {
    if (node?.type !== 'CallExpression') {
        return false;
    }
    const callee = child(node, 'callee');
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
    const callee = child(node, 'callee');
    if (callee?.type !== 'MemberExpression') {
        return false;
    }
    const matcher = memberPropertyName(callee);
    if (matcher === undefined || !EQUALITY_MATCHERS.has(matcher)) {
        return false;
    }
    const expectCall = child(callee, 'object');
    if (!isExpectCall(expectCall)) {
        return false;
    }
    const subject = childList(expectCall, 'arguments')[0];
    if (subject?.type !== 'MemberExpression' || memberPropertyName(subject) !== 'status') {
        return false;
    }
    const expected = childList(node, 'arguments')[0];
    return isStatusLiteral(expected);
}

const row = rowNamed(consumerRows, 'no-status-only-test');

/** Fires only when every `expect(…)` of the callback is a status probe: one beside a real assertion is the scalpel, and `no-probe-cluster` needs a cluster of three. */
export const noStatusOnlyTest = defineRule(
    {
        docs: row,
        messages: {
            statusOnlyProbe: {
                found: "the test's only assertions probe the HTTP status",
                fix: 'compare the whole response, ``expect(result.response).toMatch(`HTTP/1.1 …`)`` (`TEST_UPDATE=1` fills an empty one), and keep the status probe beside it only if the status is the point',
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
                    if (!isTestCallee(child(node, 'callee'))) {
                        return;
                    }
                    const callback = findTestCallback(childList(node, 'arguments'));
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
    },
);
