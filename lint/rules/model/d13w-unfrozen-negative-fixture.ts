import {
    child,
    childList,
    findProperty,
    goldenOf,
    identifierName,
    memberPropertyName,
    walk,
} from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../oxlint-api.js';
import { isTestRole } from '../../role.js';

/**
 * Does `arguments[1]` of a `toMatch(file(path), options)` call carry `{ frozen: true }`?
 * A frozen fixture opts out of update-mode rewriting, so it is exempt.
 */
function hasFrozenOption(args: AstNode[]): boolean {
    const options = args[1];
    if (options?.type !== 'ObjectExpression') {
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
 * CONVENTIONS D13 (warning) — a golden matcher whose failure is the behaviour under
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
 * The bounded second shape: a `toMatch(file('<path>'))` inside a HELPER whose
 * body also asserts a throw.
 *
 * The shape is a golden routed through a helper that owns the try/catch
 * (`catchMessage(() => …toMatch(file('./expected/f.txt')))`). Inter-procedural analysis is out of
 * an oxlint JS plugin's reach, but that helper holds both halves in one body,
 * and that is decidable.
 *
 * Bounded twice, because each bound answers a real false positive found on this
 * package's own tree. The enclosing function must not be the TEST callback
 * itself: a test that writes a fixture under `TEST_UPDATE` and later asserts a
 * diff has both halves in its body and neither belongs to the other. The
 * caller only reaches here for a golden — a `toMatch` whose argument names the
 * disk.
 */
function inAThrowingHelper(node: AstNode): boolean {
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

/** The accessors a value in place compares whole — `toMatch` on them is the framework's, rewritten by update mode. */
const RESULT_SUBJECTS = new Set([
    'body',
    'console',
    'content',
    'error',
    'errors',
    'head',
    'html',
    'json',
    'jsonLd',
    'response',
    'screen',
    'stderr',
    'stdout',
    'title',
    'tree',
    'value',
]);

/** Is the subject handed to `expect(…)` a result the framework compares whole — an accessor, a table, a `text(…)`? */
function isResultSubject(subject: AstNode | undefined): boolean {
    if (subject?.type === 'CallExpression') {
        const callee = child(subject, 'callee');
        return (
            identifierName(callee) === 'text' || memberPropertyName(callee ?? subject) === 'table'
        );
    }
    const name = subject?.type === 'MemberExpression' ? memberPropertyName(subject) : undefined;
    return name !== undefined && RESULT_SUBJECTS.has(name);
}

/**
 * Is this a `toMatch(<value>)` on a result — the value written in place,
 * which update mode rewrites in the test as it rewrites a golden file? A
 * RegExp is a part, and vitest's.
 */
function inPlaceOf(node: AstNode): boolean {
    const callee = child(node, 'callee');
    if (memberPropertyName(callee ?? node) !== 'toMatch') {
        return false;
    }
    const argument = childList(node, 'arguments')[0];
    if (argument === undefined || (argument.type === 'Literal' && 'regex' in argument)) {
        return false;
    }
    let expectCall = child(callee, 'object');
    while (expectCall?.type === 'MemberExpression') {
        expectCall = child(expectCall, 'object');
    }
    return (
        identifierName(child(expectCall, 'callee')) === 'expect' &&
        isResultSubject(childList(expectCall, 'arguments')[0])
    );
}

export const d13wUnfrozenNegativeFixture: LintRule = {
    create(context: RuleContext): Visitor {
        if (!isTestRole(identityOf(context).role)) {
            return {};
        }
        return {
            CallExpression(node: AstNode) {
                if (goldenOf(node) === undefined && !inPlaceOf(node)) {
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
        messages: lessons('d13w-unfrozen-negative-fixture', {
            unfrozenNegativeFixture: {
                found: 'a golden matcher whose mismatch is the subject, with no `{ frozen: true }`',
                fix: 'pass `{ frozen: true }` as its last argument, so `TEST_UPDATE=1` never rewrites the deliberately wrong expectation',
            },
        }),
        type: 'suggestion',
    },
};
