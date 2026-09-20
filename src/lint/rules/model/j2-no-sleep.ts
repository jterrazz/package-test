import {
    child,
    identifierName,
    importSourceVisitor,
    memberPropertyName,
    nodeEnd,
    nodeStart,
} from '../../ast.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole, roleOf } from '../../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../types.js';

/** The doubles whose implementation STAGES the world rather than waits on it. */
const DOUBLE_FACTORIES = new Set(['fn', 'mockImplementation', 'mockImplementationOnce', 'mockOf']);

/**
 * Is this call a test double taking an implementation — `vi.fn(…)`,
 * `x.mockImplementation(…)`, `mockOf<Port>({ … })`?
 *
 * The member forms are read by their PROPERTY alone, because the object is
 * whatever the test called its double.
 */
function isDoubleImplementation(node: AstNode): boolean {
    const callee = child(node, 'callee');
    if (callee === undefined) {
        return false;
    }
    const name = callee.type === 'Identifier' ? identifierName(callee) : memberPropertyName(callee);
    return name !== undefined && DOUBLE_FACTORIES.has(name);
}

/**
 * CONVENTIONS J2 — a test contains no arbitrary sleep, wherever it sits:
 * synchronisation is `see()`/`gone()` inside a scenario and `waitUntil()`
 * everywhere else. Flags `setTimeout(…)` calls (bare or as a member, e.g.
 * `globalThis.setTimeout`) and imports of `node:timers/promises`.
 *
 * The reach is every test file — a sleep in a module test beside `src/` waits
 * exactly as blindly as one under `specs/`, and went unseen while the rule
 * gated on the folder.
 *
 * What it does NOT reach is a timer inside a test DOUBLE's implementation. A
 * `vi.fn(() => setTimeout(…))` is the world being staged — a clone that settles
 * late, a handler that answers out of order — and the assertion that follows is
 * about the ORDER results come back in, which no predicate can state: a
 * `waitUntil` waits for something to become true, while what this test needs is
 * for something to happen late. The test is not the one waiting, so the rule is
 * not about it.
 */
export const j2NoSleep: LintRule = {
    create(context: RuleContext) {
        if (!isTestRole(roleOf(context.filename).role)) {
            return {};
        }
        // The source spans of the double implementations seen so far. The walk
        // Is top-down, so a double's span is recorded before anything inside it
        // Is visited — which is what makes "inside a double" answerable without
        // A parent pointer the plugin API does not give.
        const doubles: { end: number; start: number }[] = [];
        const insideADouble = (node: AstNode): boolean =>
            doubles.some((span) => nodeStart(node) >= span.start && nodeEnd(node) <= span.end);
        const visitor: Visitor = {
            CallExpression(node: AstNode) {
                if (isDoubleImplementation(node)) {
                    doubles.push({ end: nodeEnd(node), start: nodeStart(node) });
                    return;
                }
                if (insideADouble(node)) {
                    return;
                }
                const callee = child(node, 'callee');
                if (callee === undefined) {
                    return;
                }
                const name =
                    callee.type === 'Identifier'
                        ? identifierName(callee)
                        : memberPropertyName(callee);
                if (name === 'setTimeout' || name === 'setInterval') {
                    context.report({ messageId: 'sleep', node });
                    return;
                }
                // `Atomics.wait(…)` blocks the thread — a sleep in disguise.
                if (
                    name === 'wait' &&
                    callee.type === 'MemberExpression' &&
                    identifierName(child(callee, 'object')) === 'Atomics'
                ) {
                    context.report({ messageId: 'sleep', node });
                }
            },
            ...importSourceVisitor(({ node, source }) => {
                if (source === 'node:timers/promises' || source === 'timers/promises') {
                    context.report({ messageId: 'timersImport', node });
                }
            }),
        };
        return visitor;
    },
    meta: {
        docs: RULE_DOCS['j2-no-sleep'],
        messages: {
            sleep: 'No arbitrary sleep in a test — `see()`/`gone()` inside a scenario, `waitUntil(predicate)` everywhere else.',
            timersImport:
                'No timer-based sleep in a test — `see()`/`gone()` inside a scenario, `waitUntil(predicate)` everywhere else.',
        },
        type: 'problem',
    },
};
