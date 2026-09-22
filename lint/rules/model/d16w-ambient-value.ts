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
} from '../../ast.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole, roleOf } from '../../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../types.js';

/** The matchers whose whole argument D16 already reads as the oracle. */
const STRUCTURAL_MATCHERS = new Set(['toEqual', 'toMatch', 'toMatchObject', 'toStrictEqual']);

/** Every sampled call at or under `node`, by source offset. */
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

/**
 * CONVENTIONS D16w (warning) — time or randomness sampled ANYWHERE in a test.
 *
 * The wider net around D16: a value sampled into the Given travels into the
 * subject, and the assertion that reads it back is the same tautology one step
 * removed. It is a warning because the legitimate cases exist — an elapsed-time
 * bound, a label the test never asserts on — and each of them is a line the
 * author states rather than a build the rule stops.
 *
 * Silent where D16 already refuses (the same offset reported twice reads as two
 * faults), and silent on a name built in a template literal: a per-run
 * directory name is the one sampled value the framework cannot mint for you.
 */
export const d16wAmbientValue: LintRule = {
    create(context: RuleContext): Visitor {
        if (!isTestRole(roleOf(context.filename).role)) {
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
        docs: RULE_DOCS['d16w-ambient-value'],
        messages: {
            ambientValue:
                'Time or randomness sampled here: `clock.at()`, `clock.advance()`, or a token in the golden.',
        },
        type: 'suggestion',
    },
};
