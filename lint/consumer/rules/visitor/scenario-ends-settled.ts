import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import {
    chainRootName,
    child,
    childList,
    identifierName,
    memberPropertyName,
    walk,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { scenarioCallbackOf } from '../../../kit/project/framework-calls.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { consumerRows } from '../../catalogue/manifest.js';

const ACTIONS = new Set(['check', 'click', 'fill', 'press', 'rerender', 'select', 'tap']);

/** `unmount` ends it too: after it there is no screen to see. */
const TERMINALS = new Set(['gone', 'see', 'unmount']);

/** A block's last statement, both branches of an `if`, a loop body, what a `return` returns. */
const INSIDE: Record<string, string[]> = {
    AwaitExpression: ['argument'],
    DoWhileStatement: ['body'],
    ExpressionStatement: ['expression'],
    ForInStatement: ['body'],
    ForOfStatement: ['body'],
    ForStatement: ['body'],
    IfStatement: ['alternate', 'consequent'],
    LabeledStatement: ['body'],
    ReturnStatement: ['argument'],
    TryStatement: ['block', 'finalizer'],
    WhileStatement: ['body'],
};

function terminalsOf(node: AstNode | undefined): AstNode[] {
    if (node === undefined) {
        // Stryker disable next-line ArrayDeclaration: an entry that is no node settles nothing
        return [];
    }
    if (node.type === 'BlockStatement') {
        return terminalsOf(childList(node, 'body').at(-1));
    }
    if (node.type === 'SwitchStatement') {
        return childList(node, 'cases').flatMap((branch) =>
            terminalsOf(childList(branch, 'consequent').at(-1)),
        );
    }
    const inside = INSIDE[node.type];
    return inside === undefined ? [node] : inside.flatMap((key) => terminalsOf(child(node, key)));
}

function verbOn(node: AstNode | undefined, visitor: string): string | undefined {
    // Stryker disable next-line ConditionalExpression,OptionalChaining,BlockStatement: a node that is no call has no callee below
    if (node?.type !== 'CallExpression') {
        return undefined;
    }
    const callee = child(node, 'callee');
    // Stryker disable next-line ConditionalExpression,LogicalOperator: a call always has a callee
    if (callee === undefined || chainRootName(callee) !== visitor) {
        return undefined;
    }
    return memberPropertyName(callee);
}

/** A promise chain settles where its last continuation does: the wait is in the tail. */
function settles(node: AstNode, visitor: string): boolean {
    const callee = child(node, 'callee');
    // Stryker disable next-line ConditionalExpression: only a call has a callee
    if (node.type === 'CallExpression' && memberPropertyName(callee ?? node) === 'then') {
        const continuation = childList(node, 'arguments').at(-1);
        const body =
            // Stryker disable next-line ConditionalExpression: a continuation that is no function has no body to read
            continuation?.type === 'ArrowFunctionExpression' ||
            continuation?.type === 'FunctionExpression'
                ? child(continuation, 'body')
                : undefined;
        return terminalsOf(body).some((terminal) => settles(terminal, visitor));
    }
    const verb = verbOn(node, visitor);
    // Stryker disable next-line ConditionalExpression: no verb is in the set
    return verb !== undefined && TERMINALS.has(verb);
}

const row = rowNamed(consumerRows, 'scenario-ends-settled');

/** Only the visitor's calls count: the callback's own parameter is the receiver. A component's scenario is out of reach: its action often produces a call rather than a screen. */
export const scenarioEndsSettled = defineRule(
    {
        docs: row,
        messages: {
            unsettled: {
                found: 'a scenario that acts and ends without reading the screen',
                fix: 'end it on `visitor.see(<what the action produced>)` or `visitor.gone(<what it removed>)`',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'suggestion',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                before() {
                    const identity = identityOf(context);
                    // invariant: a `.test.ts` under `specs/` not yet renamed counts; a `.test.tsx` is the component's.
                    return (
                        identity.role === 'spec' || (identity.role === 'module' && identity.inSpecs)
                    );
                },
                CallExpression(node: AstNode) {
                    const scenario = scenarioCallbackOf(node);
                    // Stryker disable next-line ConditionalExpression,BlockStatement: no scenario has no visitor below
                    if (scenario === undefined) {
                        return;
                    }
                    const visitor = identifierName(childList(scenario, 'params')[0]);
                    // Stryker disable next-line ConditionalExpression,BlockStatement: no visitor is the root of no call
                    if (visitor === undefined) {
                        return;
                    }
                    let acts = false;
                    walk(scenario, (inner) => {
                        const verb = verbOn(inner, visitor);
                        // Stryker disable next-line ConditionalExpression,LogicalOperator: no verb is in the set
                        if (verb !== undefined && ACTIONS.has(verb)) {
                            acts = true;
                        }
                    });
                    if (!acts) {
                        return;
                    }
                    const ends = terminalsOf(child(scenario, 'body'));
                    if (ends.some((end) => settles(end, visitor))) {
                        return;
                    }
                    context.report({ messageId: 'unsettled', node: ends[0] ?? scenario });
                },
            };
        },
    },
);
