import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, identifierName, scenarioCallbackOf, walk } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { consumerRows } from '../../catalogue/manifest.js';

const row = rowNamed(consumerRows, 'no-expect-in-scenario');

export const noExpectInScenario = defineRule(
    {
        docs: row,
        messages: {
            expectInScenario: {
                found: '`expect()` inside a scenario',
                fix: 'move the assertion after the scenario, onto the result it returns',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
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
    },
);
