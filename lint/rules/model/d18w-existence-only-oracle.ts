import type { Context } from '@oxlint/plugins';

import { assertionOf, child, childList, findTestCallback, isTestCallee, walk } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** Matchers that pass for almost any value — the shape of an existence check. */
const EXISTENCE_MATCHERS = new Set(['toBeDefined', 'toBeTruthy']);

/** Matchers that are an existence check only under `not`. */
const NEGATED_EXISTENCE = new Set(['toBeNull', 'toBeUndefined']);

/**
 * Matchers that assert nothing once their argument is left out — and only in
 * the affirmative. `expect(onClose).not.toHaveBeenCalled()` is the precise
 * opposite: it states that nothing happened, which nothing else can state.
 */
const BARE_ONLY = new Set(['toHaveBeenCalled', 'toThrow']);

/**
 * CONVENTIONS D18w (warning) — the test's ONE assertion is an existence check.
 *
 * `expect(x).toBeDefined()` passes for `0`, `''`, `[]`, the wrong object and
 * the right one; as a test's only oracle it records that the call returned
 * rather than what it answered. A single one beside a real assertion is a
 * precondition and stays silent — the rule fires only when it is the whole
 * proof.
 *
 * A NEGATED bare matcher is the opposite of a loose one:
 * `expect(onClose).not.toHaveBeenCalled()` passes for one state of the world
 * and fails for every other, so it is a whole proof on its own.
 */
export const d18wExistenceOnlyOracle: LintRule = {
    create(context: Context): Visitor {
        if (!isTestRole(identityOf(context).role)) {
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
                let matcher: string | undefined;
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
                        (!negated && bare && BARE_ONLY.has(assertion.matcher));
                    if (isExistence) {
                        matcher = `${negated ? 'not.' : ''}${assertion.matcher}`;
                    }
                });
                if (assertions === 1 && matcher !== undefined) {
                    context.report({ data: { matcher }, messageId: 'existenceOnly', node });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['d18w-existence-only-oracle'],
        messages: lessons('d18w-existence-only-oracle', {
            existenceOnly: {
                found: "`{{matcher}}()` is this test's only oracle, and passes for almost anything",
                fix: 'assert the value itself — `toBe`/`toStrictEqual`, the whole result with `toMatch`, or the rows',
            },
        }),
        type: 'suggestion',
    },
};
