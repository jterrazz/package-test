import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import {
    assertionOf,
    child,
    childList,
    findTestCallback,
    isExpectCall,
    isSampledValue,
    isTestCallee,
    nodeStart,
    walk,
} from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isTestRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
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

/** Silent where `no-sampled-value-in-expectation` already refuses, and on a name built in a template literal: a per-run directory name is the one sampled value the framework cannot mint. */
export const noSampledValueInTest: LintRule = {
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
                walk(callback, (inner) => {
                    if (isSampledValue(inner) && !covered.has(nodeStart(inner))) {
                        context.report({ messageId: 'ambientValue', node: inner });
                    }
                });
            },
        };
    },
    meta: {
        docs: rowNamed(consumerRows, 'no-sampled-value-in-test'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'no-sampled-value-in-test'),
            {
                ambientValue: {
                    found: 'time or randomness sampled in the test',
                    fix: 'pin the time with `clock.at(…)`/`clock.advance(…)`, or absorb the value with a token in the expectation',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'suggestion',
    },
};
