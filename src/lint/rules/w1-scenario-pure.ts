import { child, identifierName, scenarioCallbackOf, walk } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext } from '../types.js';

/**
 * CONVENTIONS W1 — a scenario is the When: the visitor interacts, the capture
 * reflects the final state, and assertions live in the Then on the returned
 * result. An `expect()` inside the scenario callback is flagged.
 *
 * The three scenario-carrying actions are one list (`ast.ts`): `.visit()` on a
 * page, `.open()` on a screen and `.render()` on a component all hand the same
 * visitor to the same kind of callback.
 */
export const w1ScenarioPure: LintRule = {
    create(context: RuleContext) {
        return {
            CallExpression(node: AstNode) {
                const scenario = scenarioCallbackOf(node);
                if (scenario === undefined) {
                    return;
                }
                walk(scenario, (inner: AstNode) => {
                    if (
                        inner.type === 'CallExpression' &&
                        identifierName(child(inner, 'callee')) === 'expect'
                    ) {
                        context.report({ messageId: 'expectInScenario', node: inner });
                    }
                });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['w1-scenario-pure'],
        messages: {
            expectInScenario:
                'No expect() inside a scenario — the scenario is the When; assert the final state on the returned result in the Then.',
        },
        type: 'problem',
    },
};
