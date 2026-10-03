import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { assertionOf, isExpectCall } from '../../../kit/project/assertions.js';
import {
    child,
    childList,
    isSampledValue,
    memberPath,
    nodeEnd,
    nodeStart,
    walk,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { findTestCallback, isTestCallee } from '../../../kit/project/test-calls.js';
import { consumerRows } from '../../catalogue/manifest.js';

const STRUCTURAL_MATCHERS = new Set(['toEqual', 'toMatch', 'toMatchObject', 'toStrictEqual']);

function sampledOffsets(node: AstNode | undefined, into: Set<number>): void {
    if (node === undefined) {
        return;
    }
    walk(node, (inner) => {
        if (isSampledValue(inner)) {
            into.add(nodeStart(inner));
        }
    });
}

const PINNING_CALLS = new Set(['clock.at', 'clock.run']);

type Span = readonly [number, number];

function isDateReading(node: AstNode): boolean {
    return node.type === 'NewExpression' || memberPath(child(node, 'callee')) === 'Date.now';
}

function isPinning(statement: AstNode): boolean {
    return (
        statement.type === 'VariableDeclaration' &&
        typeof statement.kind === 'string' &&
        statement.kind.endsWith('using') &&
        childList(statement, 'declarations').some((declarator) => {
            const init = child(declarator, 'init');
            const call = init?.type === 'AwaitExpression' ? child(init, 'argument') : init;

            return (
                call?.type === 'CallExpression' &&
                PINNING_CALLS.has(memberPath(child(call, 'callee')) ?? '') &&
                childList(call, 'arguments').length > 0
            );
        })
    );
}

function pinnedSpans(body: AstNode): Span[] {
    const spans: Span[] = [];
    walk(body, (inner) => {
        if (inner.type !== 'BlockStatement') {
            return;
        }
        for (const statement of childList(inner, 'body').filter((one) => isPinning(one))) {
            spans.push([nodeEnd(statement), nodeEnd(inner)]);
        }
    });

    return spans;
}

const row = rowNamed(consumerRows, 'no-sampled-value-in-test');

/** Silent where `no-sampled-value-in-expectation` already refuses, on a name built in a template literal — a per-run directory name is the one sampled value the framework cannot mint — and on a `Date` reading after a `using` that pins the clock to an instant in the same block. */
export const noSampledValueInTest = defineRule(
    {
        docs: row,
        messages: {
            ambientValue: {
                found: 'time or randomness sampled in the test',
                fix: 'pin the time with `clock.at(…)`/`clock.advance(…)`, or absorb the value with a token in the expectation',
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
                    const covered = new Set<number>();
                    walk(callback, (inner) => {
                        if (inner.type === 'TemplateLiteral') {
                            for (const expression of childList(inner, 'expressions')) {
                                sampledOffsets(expression, covered);
                            }
                            return;
                        }
                        if (isExpectCall(inner)) {
                            for (const argument of childList(inner, 'arguments')) {
                                if (isSampledValue(argument)) {
                                    covered.add(nodeStart(argument));
                                }
                            }
                            return;
                        }
                        const assertion = assertionOf(inner);
                        if (assertion === undefined) {
                            return;
                        }
                        for (const argument of childList(inner, 'arguments')) {
                            if (STRUCTURAL_MATCHERS.has(assertion.matcher)) {
                                sampledOffsets(argument, covered);
                            } else if (isSampledValue(argument)) {
                                covered.add(nodeStart(argument));
                            }
                        }
                    });
                    const pinned = pinnedSpans(callback);
                    const isPinned = (at: number): boolean =>
                        pinned.some(([start, end]) => at >= start && at < end);
                    walk(callback, (inner) => {
                        if (
                            isSampledValue(inner) &&
                            !covered.has(nodeStart(inner)) &&
                            !(isDateReading(inner) && isPinned(nodeStart(inner)))
                        ) {
                            context.report({ messageId: 'ambientValue', node: inner });
                        }
                    });
                },
            };
        },
    },
);
