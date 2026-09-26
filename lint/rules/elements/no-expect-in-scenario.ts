import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import { child, identifierName, scenarioCallbackOf, walk } from '../../reading/ast.js';
import type { AstNode, Visitor } from '../../reading/ast.js';
import type { LintRule } from '../rule.js';

export const noExpectInScenario: LintRule = {
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
        docs: rowOf('no-expect-in-scenario'),
        messages: lessons('no-expect-in-scenario', {
            expectInScenario: {
                found: '`expect()` inside a scenario',
                fix: 'move the assertion after the scenario, onto the result it returns',
            },
        }),
        type: 'problem',
    },
};
