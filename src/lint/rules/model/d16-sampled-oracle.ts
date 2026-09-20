import {
    assertionOf,
    child,
    childList,
    findTestCallback,
    isExpectCall,
    isSampledValue,
    isTestCallee,
    memberPath,
    walk,
} from '../../ast.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole, roleOf } from '../../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../types.js';

/**
 * The matchers whose ARGUMENT is a whole expected shape — a sampled value
 * anywhere inside one of these is under the oracle just as surely as a direct
 * argument of `expect`.
 */
const STRUCTURAL_MATCHERS = new Set(['toEqual', 'toMatch', 'toMatchObject', 'toStrictEqual']);

/** The two calls that PIN the clock — under one of them, a reading is a constant. */
const PINS = new Set(['clock.advance', 'clock.at']);

/** Does this test pin the clock it then reads? */
function pinsTheClock(scope: AstNode): boolean {
    let pinned = false;
    walk(scope, (inner) => {
        if (inner.type !== 'CallExpression') {
            return;
        }
        const path = memberPath(child(inner, 'callee'));
        if (path !== undefined && PINS.has(path)) {
            pinned = true;
        }
    });
    return pinned;
}

/** Every sampled call at or under `node`. */
function sampledUnder(node: AstNode | undefined): AstNode[] {
    if (node === undefined) {
        return [];
    }
    const found: AstNode[] = [];
    walk(node, (inner) => {
        if (isSampledValue(inner)) {
            found.push(inner);
        }
    });
    return found;
}

/**
 * CONVENTIONS D16 — no sampled value under an oracle.
 *
 * A test that compares against `Date.now()` or `Math.random()` proves that two
 * readings of the same machine agree, which they always do: the assertion holds
 * whatever the subject does, and the day it fails it fails for the clock. The
 * reach is deliberately NARROW — the sampled call has to be what the assertion
 * READS (a direct argument of `expect` or of its matcher, or anywhere inside a
 * structural matcher's expected shape) — because the wider net is d16w's, at
 * warn, where a false positive costs a line rather than a build.
 *
 * A test that PINS the clock is out of reach: under `clock.at()` a reading is
 * a constant the test chose, and `expect(row.createdAt).toEqual(new Date())`
 * is the comparison the message asks for. Reporting it would have named the
 * fix the author had already applied.
 *
 * `*.specification.ts(x)` is out of reach by role: a runner's own startup
 * legitimately samples (a per-run label, a temp directory).
 */
export const d16SampledOracle: LintRule = {
    create(context: RuleContext): Visitor {
        if (!isTestRole(roleOf(context.filename).role)) {
            return {};
        }
        const report = (found: AstNode[]): void => {
            for (const node of found) {
                context.report({ messageId: 'sampledOracle', node });
            }
        };
        return {
            CallExpression(node: AstNode) {
                if (!isTestCallee(child(node, 'callee'))) {
                    return;
                }
                const callback = findTestCallback(childList(node, 'arguments'));
                if (callback === undefined || pinsTheClock(callback)) {
                    return;
                }
                walk(callback, (inner) => {
                    // `expect(<sampled>)` — the subject itself is a reading.
                    if (isExpectCall(inner)) {
                        report(childList(inner, 'arguments').filter(isSampledValue));
                        return;
                    }
                    const assertion = assertionOf(inner);
                    if (assertion === undefined) {
                        return;
                    }
                    const args = childList(inner, 'arguments');
                    report(
                        STRUCTURAL_MATCHERS.has(assertion.matcher)
                            ? args.flatMap((argument) => sampledUnder(argument))
                            : args.filter(isSampledValue),
                    );
                });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['d16-sampled-oracle'],
        messages: {
            sampledOracle:
                'A sampled value under `expect` is a flake: pin it with `clock.at()`, or match it with an `iso8601` token or `match.uuid`.',
        },
        type: 'problem',
    },
};
