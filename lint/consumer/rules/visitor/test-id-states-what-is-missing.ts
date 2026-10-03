import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Comment, Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import {
    child,
    childList,
    memberPropertyName,
    SCENARIO_ACTIONS,
    walk,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

const REASON = /\/\/\s*testId:\s*\S/u;

const row = rowNamed(consumerRows, 'test-id-states-what-is-missing');

/** Accepted on the call's line or the one above: consumers arm `eslint/no-inline-comments`. */
export const testIdStatesWhatIsMissing = defineRule(
    {
        docs: row,
        messages: {
            unexplainedTestId: {
                found: '`testId()` with no line saying what the element lacks',
                fix: 'name the element with `button()`/`link()`/`field()`/`heading()`/`content()`, or write `// testId: <no accessible name|no role|…>` on this line or the one above',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            let source: Source = { comments: [], lines: [], text: '' };
            return {
                before() {
                    if (!isTestRole(identityOf(context).role)) {
                        return false;
                    }
                    const { text } = context.sourceCode;
                    source = {
                        comments: context.sourceCode.getAllComments(),
                        lines: text.split('\n'),
                        text,
                    };
                    return true;
                },
                CallExpression(node: AstNode) {
                    const scenario = scenarioOf(node);
                    if (scenario === undefined) {
                        return;
                    }
                    walk(scenario, (inner: AstNode) => {
                        if (
                            isTestIdCall(inner) &&
                            !stated(source, lineAt(source.text, startOf(inner)))
                        ) {
                            context.report({ messageId: 'unexplainedTestId', node: inner });
                        }
                    });
                },
            };
        },
    },
);

type Source = { comments: Comment[]; lines: string[]; text: string };

function startOf(node: AstNode): number | undefined {
    if (typeof node.start === 'number') {
        return node.start;
    }
    const range = node.range as [number, number] | undefined;
    return range?.[0];
}

function lineAt(text: string, offset: number | undefined): number {
    return offset === undefined ? 0 : text.slice(0, offset).split('\n').length;
}

function stated(source: Source, line: number): boolean {
    const own = source.lines[line - 1] ?? '';
    const above = source.lines[line - 2] ?? '';
    if (REASON.test(own) || REASON.test(above)) {
        return true;
    }
    // invariant: a block comment, or one the formatter moved, is invisible to the text scan.
    return source.comments.some((comment) => {
        const at = lineAt(source.text, comment.start ?? comment.range?.[0]);
        return (at === line || at === line - 1) && REASON.test(`//${comment.value}`);
    });
}

function scenarioOf(node: AstNode): AstNode | undefined {
    const callee = child(node, 'callee');
    const member = callee ? memberPropertyName(callee) : undefined;
    if (member === undefined || !SCENARIO_ACTIONS.has(member)) {
        return undefined;
    }
    const scenario = childList(node, 'arguments')[1];
    return scenario?.type === 'ArrowFunctionExpression' || scenario?.type === 'FunctionExpression'
        ? scenario
        : undefined;
}

function isTestIdCall(node: AstNode): boolean {
    const callee = node.type === 'CallExpression' ? child(node, 'callee') : undefined;
    return callee?.type === 'Identifier' && callee.name === 'testId';
}
