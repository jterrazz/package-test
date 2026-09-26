import type { Comment, Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import { memberPropertyName, SCENARIO_ACTIONS, walk } from '../../reading/ast.js';
import type { AstNode, Visitor } from '../../reading/ast.js';
import { identityOf } from '../../reading/linted-file.js';
import { isTestRole } from '../../reading/role.js';
import type { LintRule } from '../rule.js';

const REASON = /\/\/\s*testId:\s*\S/u;

/** Accepted on the call's line or the one above: consumers arm `eslint/no-inline-comments`. */
export const testIdStatesWhatIsMissing: LintRule = {
    createOnce(context: Context): Visitor {
        let lines: string[] = [];
        let comments: Comment[] = [];

        const lineOf = (node: AstNode): number => {
            const offset = startOf(node);
            if (offset === undefined) {
                return 0;
            }
            return context.sourceCode.text.slice(0, offset).split('\n').length;
        };

        const stated = (line: number): boolean => {
            const own = lines[line - 1] ?? '';
            const above = lines[line - 2] ?? '';
            if (REASON.test(own) || REASON.test(above)) {
                return true;
            }
            // A block comment, or one the formatter moved, is invisible to the text scan.
            return comments.some((comment) => {
                const at = commentLine(context, comment);
                return (at === line || at === line - 1) && REASON.test(`//${comment.value}`);
            });
        };

        return {
            before() {
                if (!isTestRole(identityOf(context).role)) {
                    return false;
                }
                lines = context.sourceCode.text.split('\n');
                comments = context.sourceCode.getAllComments();
                return true;
            },
            CallExpression(node: AstNode) {
                const callee = node.callee as AstNode | undefined;
                const member = callee ? memberPropertyName(callee) : undefined;
                if (member === undefined || !SCENARIO_ACTIONS.has(member)) {
                    return;
                }
                const args = node.arguments as AstNode[] | undefined;
                const scenario = args?.[1];
                if (
                    scenario?.type !== 'ArrowFunctionExpression' &&
                    scenario?.type !== 'FunctionExpression'
                ) {
                    return;
                }
                walk(scenario, (inner: AstNode) => {
                    if (inner.type !== 'CallExpression') {
                        return;
                    }
                    const innerCallee = inner.callee as AstNode | undefined;
                    if (innerCallee?.type !== 'Identifier' || innerCallee.name !== 'testId') {
                        return;
                    }
                    if (!stated(lineOf(inner))) {
                        context.report({ messageId: 'unexplainedTestId', node: inner });
                    }
                });
            },
        };
    },
    meta: {
        docs: rowOf('test-id-states-what-is-missing'),
        messages: lessons('test-id-states-what-is-missing', {
            unexplainedTestId: {
                found: '`testId()` with no line saying what the element lacks',
                fix: 'name the element with `button()`/`link()`/`field()`/`heading()`/`content()`, or write `// testId: <no accessible name|no role|…>` on this line or the one above',
            },
        }),
        type: 'problem',
    },
};

function startOf(node: AstNode): number | undefined {
    if (typeof node.start === 'number') {
        return node.start;
    }
    const range = node.range as [number, number] | undefined;
    return range?.[0];
}

function commentLine(context: Context, comment: Comment): number {
    const offset = comment.start ?? comment.range?.[0];
    if (offset === undefined) {
        return 0;
    }
    return context.sourceCode.text.slice(0, offset).split('\n').length;
}
