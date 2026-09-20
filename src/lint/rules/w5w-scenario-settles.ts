import { child, childList, memberPropertyName, scenarioCallbackOf, walk } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import { isTestRole, roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** The verbs that CHANGE the screen — after one of them, something is in flight. */
const ACTIONS = new Set([
    'check',
    'click',
    'fill',
    'press',
    'rerender',
    'select',
    'tap',
    'unmount',
]);

/** The two verbs that WAIT — the settled screen is what they prove. */
const SETTLERS = new Set(['gone', 'see']);

/** The verb a statement ends on, when it is one of the visitor's. */
function verbOf(statement: AstNode | undefined): string | undefined {
    let expression = child(statement, 'expression') ?? statement;
    while (expression?.type === 'AwaitExpression') {
        expression = child(expression, 'argument');
    }
    if (expression?.type !== 'CallExpression') {
        return undefined;
    }
    const callee = child(expression, 'callee');
    return callee === undefined ? undefined : memberPropertyName(callee);
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
 * A scenario that only reads (a visit with a `see`, no action) is out of reach:
 * there is nothing in flight to settle.
 */
export const w5wScenarioSettles: LintRule = {
    create(context: RuleContext): Visitor {
        if (!isTestRole(roleOf(context.filename).role)) {
            return {};
        }
        return {
            CallExpression(node: AstNode) {
                const scenario = scenarioCallbackOf(node);
                if (scenario === undefined) {
                    return;
                }
                let acts = false;
                walk(scenario, (inner) => {
                    if (inner.type !== 'CallExpression') {
                        return;
                    }
                    const callee = child(inner, 'callee');
                    const verb = callee === undefined ? undefined : memberPropertyName(callee);
                    if (verb !== undefined && ACTIONS.has(verb)) {
                        acts = true;
                    }
                });
                if (!acts) {
                    return;
                }
                const body = child(scenario, 'body');
                // A one-expression arrow body IS its last statement.
                const last =
                    body?.type === 'BlockStatement' ? childList(body, 'body').at(-1) : body;
                const verb = verbOf(last);
                if (verb === undefined || !SETTLERS.has(verb)) {
                    context.report({ messageId: 'unsettled', node: last ?? scenario });
                }
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
