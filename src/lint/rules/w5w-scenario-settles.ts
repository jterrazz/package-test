import {
    chainRootName,
    child,
    childList,
    identifierName,
    memberPropertyName,
    scenarioCallbackOf,
    walk,
} from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import { roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** The verbs that CHANGE the screen — after one of them, something is in flight. */
const ACTIONS = new Set(['check', 'click', 'fill', 'press', 'rerender', 'select', 'tap']);

/**
 * The verbs a scenario may END on.
 *
 * `see` and `gone` are the two that WAIT — the settled screen is what they
 * prove. `unmount` ends it too: after it there is no screen left to see, so
 * demanding one would be asking for an assertion that cannot hold.
 */
const TERMINALS = new Set(['gone', 'see', 'unmount']);

/**
 * Where the END of a scenario hides inside each statement shape — the keys to
 * follow, rather than the node itself.
 *
 * A scenario ends on the last statement of a block, on either branch of an
 * `if`, inside the body of a loop, on what a `return` returns. Reading only the
 * outermost expression statement told an author that a loop whose every pass
 * ends on `see()` settles nothing.
 */
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

/** The expressions a scenario can actually end on. */
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

/** The verb of a call on the visitor — `undefined` for anything else. */
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

/** Does this expression END on one of the visitor's waiting verbs? */
function settles(node: AstNode, visitor: string): boolean {
    const verb = verbOn(node, visitor);
    if (verb !== undefined) {
        return TERMINALS.has(verb);
    }
    // `visitor.click().then(() => visitor.see(…))` — the wait is in the tail.
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

/**
 * CONVENTIONS W5w (warning) — a scenario that ACTS ends on `see()` or `gone()`.
 *
 * The capture is taken when the callback returns, so a scenario whose last
 * statement is a click hands the golden whatever the page happened to be
 * showing at that instant: the assertion is a race the suite loses on a slower
 * machine, and the failure reads as a flaky test rather than as a missing wait.
 * `see()` and `gone()` ARE the synchronisation — naming what the action
 * produced is what makes the capture reproducible.
 *
 * Everything the rule reads is the VISITOR's: the callback's own parameter is
 * the receiver, so a `db.select()` in the Given and an `array.fill(0)` are not
 * actions, and a `see()` on something else is not a wait. The end of the
 * scenario is resolved through the shapes a scenario ends in — a block, a
 * branch, a loop body, a `return`, a `.then()` — because a scenario that ends
 * on a loop full of `see()` is settled by anything a reader would call that.
 *
 * A scenario that only reads is out of reach: there is nothing in flight. So
 * is a component's, whose action often produces a CALL rather than a screen
 * (`expect(onSubmit).toHaveBeenCalledOnce()` outside the scenario) — the
 * vocabulary has no word for that yet, and `see()` is not it.
 *
 * The reach is the specs TREE, not the `.spec.ts` suffix alone: a facet spec
 * that has not been renamed yet is the same scenario, and a rule that waited
 * for the rename would say nothing about the tree it is asked to migrate.
 */
export const w5wScenarioSettles: LintRule = {
    create(context: RuleContext): Visitor {
        const identity = roleOf(context.filename);
        // A scenario of the ASSEMBLED product: a `.spec.ts`, or — in a tree
        // That has not taken the suffix yet — a `.test.ts` under `specs/`. A
        // `.test.tsx` is the component's, and out of reach.
        if (identity.role !== 'spec' && !(identity.role === 'module' && identity.inSpecs)) {
            return {};
        }
        return {
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
        docs: RULE_DOCS['w5w-scenario-settles'],
        messages: {
            unsettled:
                'End on `visitor.see(<what the action produced>)` or `visitor.gone(<what it removed>)` — the capture reads the settled screen.',
        },
        type: 'suggestion',
    },
};
