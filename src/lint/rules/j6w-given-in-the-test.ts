import { child, childList, identifierName, memberPath, walk } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import { isTestRole, roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** The hooks that BUILD something — there is no restore-only form of these. */
const BUILDERS = new Set(['beforeAll', 'beforeEach']);

/** The hooks that may stand, when all they do is give back what the test took. */
const TEARDOWNS = new Set(['afterAll', 'afterEach']);

/** The calls a teardown may carry: each one RESTORES, none of them builds. */
const RESTORES = new Set([
    'cleanup',
    'vi.resetAllMocks',
    'vi.restoreAllMocks',
    'vi.unstubAllEnvs',
    'vi.unstubAllGlobals',
    'vi.useRealTimers',
]);

/** Is every call in this hook's body a restore? */
function restoreOnly(hook: AstNode): boolean {
    const callback = childList(hook, 'arguments')[0];
    if (callback === undefined) {
        return false;
    }
    // `afterAll(cleanup)`, `afterEach(vi.restoreAllMocks)` — the restore handed
    // Over by name, A4's own idiom. Reading the bare identifier alone made a
    // `vi` member fall through to the walk, which finds no call at all and
    // Reported the teardown as doing more than giving back.
    const handedOver = memberPath(callback) ?? identifierName(callback);
    if (handedOver !== undefined) {
        return RESTORES.has(handedOver);
    }
    let calls = 0;
    let restores = 0;
    walk(callback, (inner) => {
        if (inner.type !== 'CallExpression') {
            return;
        }
        calls += 1;
        const path = memberPath(child(inner, 'callee'));
        if (path !== undefined && RESTORES.has(path)) {
            restores += 1;
        }
    });
    return calls >= 1 && calls === restores;
}

/**
 * CONVENTIONS J6w (warning) — the Given lives INSIDE the test.
 *
 * A hook moves the setup out of the only place a reader looks: the test states
 * a name and an assertion, and what it stands on is somewhere above, shared
 * with every other test in the file and quietly depended on by half of them. A
 * shared value is a function each test calls; the framework's own primitives —
 * `clock.at()`, `intercept()`, `using` — restore themselves, so the hook they
 * would have needed does not exist.
 *
 * A teardown that only GIVES BACK is not a Given and stands: `afterAll(cleanup)`
 * is A4's own idiom, and a file that took the timers or the globals says so
 * where it gives them back.
 */
export const j6wGivenInTheTest: LintRule = {
    create(context: RuleContext): Visitor {
        if (!isTestRole(roleOf(context.filename).role)) {
            return {};
        }
        return {
            CallExpression(node: AstNode) {
                const name = identifierName(child(node, 'callee'));
                if (name === undefined) {
                    return;
                }
                if (BUILDERS.has(name)) {
                    context.report({ data: { hook: name }, messageId: 'givenInAHook', node });
                    return;
                }
                if (TEARDOWNS.has(name) && !restoreOnly(node)) {
                    context.report({ data: { hook: name }, messageId: 'teardownDoesMore', node });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['j6w-given-in-the-test'],
        messages: {
            givenInAHook:
                '`{{hook}}` moves the Given out of the test: a shared value is a function each test calls, and `clock.at()` restores itself.',
            teardownDoesMore:
                '`{{hook}}` does more than give back what the test took — keep the restores here and move the rest into the test.',
        },
        type: 'suggestion',
    },
};
