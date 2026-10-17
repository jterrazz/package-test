import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Comment, Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import {
    child,
    childList,
    identifierName,
    memberPropertyName,
    nodeStart,
    walk,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { SCENARIO_ACTIONS } from '../../../kit/project/framework-calls.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

const REASON = /^\s*testId:\s*\S/u;

const row = rowNamed(consumerRows, 'test-id-states-what-is-missing');

/** Accepted on the call's line or the one above: consumers arm `eslint/no-inline-comments`. */
export const testIdStatesWhatIsMissing = defineRule(
    {
        docs: row,
        messages: {
            unexplainedTestId: {
                found: '`testId()` with no line saying what the element lacks',
                fix: 'name the element with `button()`/`link()`/`field()`/`heading()`/`content()`, or write `// testId: <no accessible name|no role|...>` on this line or the one above',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                before: () => isTestRole(identityOf(context).role),
                CallExpression(node: AstNode) {
                    const scenario = scenarioOf(node);
                    if (scenario === undefined) {
                        return;
                    }
                    const { text } = context.sourceCode;
                    const comments = context.sourceCode.getAllComments();
                    walk(scenario, (inner: AstNode) => {
                        if (isTestIdCall(inner) && !stated(comments, text, nodeStart(inner))) {
                            context.report({ messageId: 'unexplainedTestId', node: inner });
                        }
                    });
                },
            };
        },
    },
);

const lineAt = (text: string, offset: number): number => text.slice(0, offset).split('\n').length;

function stated(comments: readonly Comment[], text: string, at: number): boolean {
    const line = lineAt(text, at);

    return comments.some((comment) => {
        const written = lineAt(text, comment.start);

        return (written === line || written === line - 1) && REASON.test(comment.value);
    });
}

function scenarioOf(node: AstNode): AstNode | undefined {
    const member = memberPropertyName(child(node, 'callee') ?? node);
    // Stryker disable next-line ConditionalExpression: no name is in the set
    if (member === undefined || !SCENARIO_ACTIONS.has(member)) {
        return undefined;
    }
    const scenario = childList(node, 'arguments')[1];
    return scenario?.type === 'ArrowFunctionExpression' || scenario?.type === 'FunctionExpression'
        ? scenario
        : undefined;
}

function isTestIdCall(node: AstNode): boolean {
    // Stryker disable next-line ConditionalExpression: only a call has a callee
    return node.type === 'CallExpression' && identifierName(child(node, 'callee')) === 'testId';
}
