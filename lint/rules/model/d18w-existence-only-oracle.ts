import type { Context } from '@oxlint/plugins';

import { assertionOf, child, childList, findTestCallback, isTestCallee, walk } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

const EXISTENCE_MATCHERS = new Set(['toBeDefined', 'toBeTruthy']);

const NEGATED_EXISTENCE = new Set(['toBeNull', 'toBeUndefined']);

/** Only affirmative: `expect(onClose).not.toHaveBeenCalled()` states that nothing happened, which nothing else can. */
const BARE_ONLY = new Set(['toHaveBeenCalled', 'toThrow']);

/** Fires only when it is the whole proof: beside a real assertion it is a precondition. */
export const d18wExistenceOnlyOracle: LintRule = {
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
