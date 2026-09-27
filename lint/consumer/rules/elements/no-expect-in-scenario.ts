import { lessonsAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { child, identifierName, scenarioCallbackOf, walk } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

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
        docs: rowNamed(consumerRows, 'no-expect-in-scenario'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'no-expect-in-scenario'),
            {
                expectInScenario: {
                    found: '`expect()` inside a scenario',
                    fix: 'move the assertion after the scenario, onto the result it returns',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'problem',
    },
};
