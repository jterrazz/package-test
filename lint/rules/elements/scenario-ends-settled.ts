import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import {
    chainRootName,
    child,
    childList,
    identifierName,
    memberPropertyName,
    scenarioCallbackOf,
    walk,
} from '../../reading/ast.js';
import type { AstNode } from '../../reading/ast.js';
import { identityOf } from '../../reading/linted-file.js';
import type { LintRule, Visitor } from '../rule.js';

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
    if (node?.type !== 'CallExpression') {
        return undefined;
    }
    const callee = child(node, 'callee');
    if (callee === undefined || chainRootName(callee) !== visitor) {
        return undefined;
    }
    return memberPropertyName(callee);
}

function settles(node: AstNode, visitor: string): boolean {
    const verb = verbOn(node, visitor);
    if (verb !== undefined) {
        return TERMINALS.has(verb);
    }
    // The wait is in the tail.
    const callee = child(node, 'callee');
    if (node.type !== 'CallExpression' || callee === undefined) {
        return false;
    }
    if (memberPropertyName(callee) !== 'then') {
        return false;
    }
    const continuation = childList(node, 'arguments').at(-1);
    const body =
        continuation?.type === 'ArrowFunctionExpression' ||
        continuation?.type === 'FunctionExpression'
            ? child(continuation, 'body')
            : undefined;
    return terminalsOf(body).some((terminal) => settles(terminal, visitor));
}

/** Only the visitor's calls count: the callback's own parameter is the receiver. A component's scenario is out of reach: its action often produces a call rather than a screen. */
export const scenarioEndsSettled: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before() {
                const identity = identityOf(context);
                // A `.test.ts` under `specs/` not yet renamed counts; a `.test.tsx` is the component's.
                return identity.role === 'spec' || (identity.role === 'module' && identity.inSpecs);
            },
            CallExpression(node: AstNode) {
                const scenario = scenarioCallbackOf(node);
                if (scenario === undefined) {
                    return;
                }
                const visitor = identifierName(childList(scenario, 'params')[0]);
                if (visitor === undefined) {
                    return;
                }
                let acts = false;
                walk(scenario, (inner) => {
                    const verb = verbOn(inner, visitor);
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
    meta: {
        docs: rowOf('scenario-ends-settled'),
        messages: lessons('scenario-ends-settled', {
            unsettled: {
                found: 'a scenario that acts and ends without reading the screen',
                fix: 'end it on `visitor.see(<what the action produced>)` or `visitor.gone(<what it removed>)`',
            },
        }),
        type: 'suggestion',
    },
};
