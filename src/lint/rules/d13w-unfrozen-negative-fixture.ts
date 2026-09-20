import { findProperty, memberPropertyName, walk } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import { isTestRole, roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/**
 * Does `arguments[1]` of a `toMatch(name, options)` call carry `{ frozen: true }`?
 * A frozen fixture opts out of update-mode rewriting, so it is exempt.
 */
function hasFrozenOption(args: AstNode[]): boolean {
    const options = args[1];
    if (options === undefined || options.type !== 'ObjectExpression') {
        return false;
    }
    const frozen = findProperty(options, 'frozen');
    const value = frozen?.value as AstNode | undefined;
    return value?.type === 'Literal' && value.value === true;
}

/**
 * Is this `toMatch(…)` call nested inside a WRAPPING `expect(…)` — the shape of a
 * negative assertion (`expect(() => …toMatch(…)).toThrow()` or
 * `expect(…toMatch(…)).rejects.toThrow()`)? The subject's own `expect(x)` is the
 * member OBJECT of `.toMatch` (a descendant), never an ancestor, so a positive
 * `expect(x).toMatch('f')` never trips this. The walk stays inside the current
 * expression: it stops at the first statement boundary or non-`expect` call, so
 * a `toMatch` merely written inside `inUpdateMode(() => …)` is NOT flagged.
 */
const TRANSPARENT_ANCESTORS = new Set([
    'ArrowFunctionExpression',
    'AwaitExpression',
    'ChainExpression',
    'MemberExpression',
    'ParenthesizedExpression',
    'TSAsExpression',
    'TSNonNullExpression',
]);

function isWrappedInExpect(node: AstNode): boolean {
    let current = node.parent as AstNode | undefined;
    while (current !== undefined) {
        if (current.type === 'CallExpression') {
            const callee = current.callee as AstNode | undefined;
            return callee?.type === 'Identifier' && callee.name === 'expect';
        }
        if (!TRANSPARENT_ANCESTORS.has(current.type)) {
            return false;
        }
        current = current.parent as AstNode | undefined;
    }
    return false;
}

/**
 * CONVENTIONS D13 (warning) — a `toMatch` whose failure is the behaviour under
 * test (wrapped in `expect(() => …).toThrow()` or `expect(…).rejects.toThrow()`)
 * asserts a DELIBERATELY-WRONG or MISSING fixture. Under `TEST_UPDATE=1` an
 * unfrozen fixture is silently rewritten with the actual output — the matcher
 * writes instead of throwing — which destroys the negative case (the assertion
 * then no longer throws). Pass `{ frozen: true }` so the fixture is never
 * rewritten and the mismatch/error still throws in update mode.
 *
 * Two shapes, and the rule takes both: the WRAPPED form
 * (`expect(() => …toMatch(…)).toThrow()`), which is exact, and the bounded
 * heuristic of {@link inAThrowingHelper} — a golden inside a HELPER whose body
 * also asserts a throw, which is where a helper that owns the try/catch puts
 * it. There is no process note left behind: what the AST could not reach was
 * ONE shape, and this is it.
 */
const FUNCTION_NODES = new Set([
    'ArrowFunctionExpression',
    'FunctionDeclaration',
    'FunctionExpression',
]);

/** Does this subtree contain a `.toThrow(…)` call or a `.rejects` member? */
function assertsAThrow(body: AstNode): boolean {
    let found = false;
    walk(body, (inner: AstNode) => {
        if (found) {
            return;
        }
        const name = memberPropertyName(inner);
        if (name === 'toThrow' || name === 'toThrowError' || name === 'rejects') {
            found = true;
        }
    });
    return found;
}

/** Is this function the callback a `test(…)` / `it(…)` was handed? */
function isTestCallback(fn: AstNode): boolean {
    const parent = fn.parent as AstNode | undefined;
    if (parent?.type !== 'CallExpression') {
        return false;
    }
    const callee = parent.callee as AstNode | undefined;
    if (callee === undefined) {
        return false;
    }
    const name =
        callee.type === 'Identifier' ? (callee.name as string) : memberPropertyName(callee);
    return name === 'it' || name === 'test';
}

/**
 * The bounded second shape: a `toMatch('<file>')` inside a HELPER whose body
 * also asserts a throw.
 *
 * The shape is a golden routed through a helper that owns the try/catch
 * (`catchMessage(() => …toMatch('f'))`). Inter-procedural analysis is out of
 * an oxlint JS plugin's reach, but that helper holds both halves in one body,
 * and that is decidable.
 *
 * Bounded twice, because each bound answers a real false positive found on this
 * package's own tree. The enclosing function must not be the TEST callback
 * itself: a test that writes a fixture under `TEST_UPDATE` and later asserts a
 * diff has both halves in its body and neither belongs to the other. And the
 * `toMatch` must name a FILE, never a regex: `toMatch(/^hex/)` compares a
 * string to a pattern and has no fixture update mode could overwrite.
 */
function inAThrowingHelper(node: AstNode): boolean {
    const [first] = (node.arguments as AstNode[] | undefined) ?? [];
    const namesAFile = first?.type === 'Literal' && typeof first.value === 'string';
    if (!namesAFile) {
        return false;
    }
    let current = node.parent as AstNode | undefined;
    while (current !== undefined) {
        if (FUNCTION_NODES.has(current.type)) {
            if (isTestCallback(current)) {
                return false;
            }
            const body = current.body as AstNode | undefined;
            return body !== undefined && assertsAThrow(body);
        }
        current = current.parent as AstNode | undefined;
    }
    return false;
}

export const d13wUnfrozenNegativeFixture: LintRule = {
    create(context: RuleContext): Visitor {
        if (!isTestRole(roleOf(context.filename).role)) {
            return {};
        }
        return {
            CallExpression(node: AstNode) {
                const callee = node.callee as AstNode | undefined;
                if (callee === undefined || memberPropertyName(callee) !== 'toMatch') {
                    return;
                }
                if (!isWrappedInExpect(node) && !inAThrowingHelper(node)) {
                    return;
                }
                if (hasFrozenOption((node.arguments as AstNode[] | undefined) ?? [])) {
                    return;
                }
                context.report({ messageId: 'unfrozenNegativeFixture', node });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['d13w-unfrozen-negative-fixture'],
        messages: {
            unfrozenNegativeFixture:
                'This toMatch asserts a mismatch (wrapped in expect(…).toThrow/.rejects) — pass { frozen: true } so TEST_UPDATE=1 never overwrites the deliberately-wrong fixture.',
        },
        type: 'suggestion',
    },
};
