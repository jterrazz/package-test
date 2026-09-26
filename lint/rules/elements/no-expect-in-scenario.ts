import type { Context } from '@oxlint/plugins';

import { lessons } from '../../catalogue/lesson.js';
import { RULE_DOCS } from '../../catalogue/manifest.js';
import { child, identifierName, scenarioCallbackOf, walk } from '../../reading/ast.js';
import type { AstNode } from '../../reading/ast.js';
import type { LintRule, Visitor } from '../rule.js';

export const w1ScenarioPure: LintRule = {
    createOnce(context: Context): Visitor {
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
