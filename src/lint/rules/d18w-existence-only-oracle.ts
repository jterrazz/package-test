import { assertionOf, child, childList, findTestCallback, isTestCallee, walk } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import { isTestRole, roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** Matchers that pass for almost any value — the shape of an existence check. */
const EXISTENCE_MATCHERS = new Set(['toBeDefined', 'toBeTruthy']);

/** Matchers that are an existence check only under `not`. */
const NEGATED_EXISTENCE = new Set(['toBeNull', 'toBeUndefined']);

/** Matchers that assert nothing once their argument is left out. */
const BARE_ONLY = new Set(['toHaveBeenCalled', 'toThrow']);

/**
 * CONVENTIONS D18w (warning) — the test's ONE assertion is an existence check.
 *
 * `expect(x).toBeDefined()` passes for `0`, `''`, `[]`, the wrong object and
 * the right one; as a test's only oracle it records that the call returned
 * rather than what it answered. A single one beside a real assertion is a
 * precondition and stays silent — the rule fires only when it is the whole
 * proof.
 */
export const d18wExistenceOnlyOracle: LintRule = {
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
                let assertions = 0;
                let existence = 0;
                walk(callback, (inner) => {
                    const assertion = assertionOf(inner);
                    if (assertion === undefined) {
                        return;
                    }
                    assertions += 1;
                    const negated = assertion.modifiers.includes('not');
                    const bare = childList(inner, 'arguments').length === 0;
                    const isExistence =
                        (!negated && EXISTENCE_MATCHERS.has(assertion.matcher)) ||
                        (negated && NEGATED_EXISTENCE.has(assertion.matcher)) ||
                        (bare && BARE_ONLY.has(assertion.matcher));
                    if (isExistence) {
                        existence += 1;
                    }
                });
                if (assertions === 1 && existence === 1) {
                    context.report({ messageId: 'existenceOnly', node });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['d18w-existence-only-oracle'],
        messages: {
            existenceOnly:
                '`toBeDefined()` passes for almost anything: assert the value, a golden, or a row.',
        },
        type: 'suggestion',
    },
};
