import { importSourceVisitor, memberPropertyName } from '../../ast.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole, roleOf } from '../../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../types.js';

/**
 * CONVENTIONS J2 — a test contains no arbitrary sleep, wherever it sits:
 * synchronisation is `see()`/`gone()` inside a scenario and `waitUntil()`
 * everywhere else. Flags `setTimeout(…)` calls (bare or as a member, e.g.
 * `globalThis.setTimeout`) and imports of `node:timers/promises`.
 *
 * The reach is every test file — a sleep in a module test beside `src/` waits
 * exactly as blindly as one under `specs/`, and went unseen while the rule
 * gated on the folder.
 */
export const j2NoSleep: LintRule = {
    create(context: RuleContext) {
        if (!isTestRole(roleOf(context.filename).role)) {
            return {};
        }
        const visitor: Visitor = {
            CallExpression(node: AstNode) {
                const callee = node.callee as AstNode | undefined;
                if (callee === undefined) {
                    return;
                }
                const name =
                    callee.type === 'Identifier'
                        ? (callee.name as string)
                        : memberPropertyName(callee);
                if (name === 'setTimeout' || name === 'setInterval') {
                    context.report({ messageId: 'sleep', node });
                    return;
                }
                // `Atomics.wait(…)` blocks the thread — a sleep in disguise.
                if (
                    name === 'wait' &&
                    callee.type === 'MemberExpression' &&
                    (callee.object as AstNode | undefined)?.type === 'Identifier' &&
                    ((callee.object as AstNode).name as string) === 'Atomics'
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
