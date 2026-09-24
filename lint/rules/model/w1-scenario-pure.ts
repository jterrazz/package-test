import type { Context } from '@oxlint/plugins';

import { child, identifierName, scenarioCallbackOf, walk } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule } from '../../rule-shape.js';

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
    create(context: Context) {
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
        messages: lessons('w1-scenario-pure', {
            expectInScenario: {
                found: '`expect()` inside a scenario',
                fix: 'move the assertion after the scenario, onto the result it returns',
            },
        }),
        type: 'problem',
    },
};
