import {
    assertionOf,
    child,
    childList,
    findTestCallback,
    isTestCallee,
    memberPath,
    stringValue,
    walk,
} from '../../ast.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole, roleOf } from '../../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../types.js';

/** How many probes on one subject make a cluster, unless the option says otherwise. */
const DEFAULT_THRESHOLD = 3;

/**
 * The accessors a golden can pin whole — a stream, a rendered page, a tree.
 *
 * A probe on `result.status` is not on this list: a status IS one value, and
 * d15w already owns the test whose only oracle is one. Neither are `value` and
 * `error`: a returned value and a raised error are single readings that a
 * component's `input.value` and a refusal's message spell the same way, and
 * "golden the subject" is not the fix for three reads of one string.
 */
const GOLDENABLE = new Set([
    'alternates',
    'canonical',
    'content',
    'head',
    'html',
    'meta()',
    'stderr',
    'stdout',
    'tree',
]);

/** The matchers that read a PIECE of a subject rather than the whole of it. */
const PROBES = new Set(['toBe', 'toContain', 'toEqual', 'toMatch']);

/** Is the subject one of the accessors a golden could pin whole? */
function goldenableSubject(subject: AstNode | undefined): string | undefined {
    const path = memberPath(subject);
    if (path === undefined) {
        return undefined;
    }
    const tail = path.slice(path.lastIndexOf('.') + 1);
    return GOLDENABLE.has(tail) ? path : undefined;
}

/**
 * CONVENTIONS D19w (warning) — three probes on one goldenable subject and no
 * golden on it.
 *
 * Each `toContain` states one line of an output the framework can pin whole;
 * three of them state three, leave everything between them unstated, and still
 * have to be rewritten one by one the day the output changes. The threshold is
 * an option because "how many greps are a cluster" is the one part of this that
 * is taste — the default is three, and a `toMatch('<file>')` on the same
 * subject silences it however many probes stand beside it.
 */
export const d19wProbeCluster: LintRule = {
    create(context: RuleContext): Visitor {
        if (!isTestRole(roleOf(context.filename).role)) {
            return {};
        }
        const option = context.options[0];
        const stated =
            typeof option === 'object' && option !== null && 'threshold' in option
                ? option.threshold
                : undefined;
        const threshold = typeof stated === 'number' ? stated : DEFAULT_THRESHOLD;
        return {
            CallExpression(node: AstNode) {
                if (!isTestCallee(child(node, 'callee'))) {
                    return;
                }
                const callback = findTestCallback(childList(node, 'arguments'));
                if (callback === undefined) {
                    return;
                }
                const probes = new Map<string, number>();
                const goldened = new Set<string>();
                walk(callback, (inner) => {
                    const assertion = assertionOf(inner);
                    if (assertion === undefined) {
                        return;
                    }
                    const subject = goldenableSubject(assertion.subject);
                    if (subject === undefined) {
                        return;
                    }
                    const [argument] = childList(inner, 'arguments');
                    // A golden names a FILE; `toMatch(/re/)` is a probe.
                    if (assertion.matcher === 'toMatch' && stringValue(argument) !== undefined) {
                        goldened.add(subject);
                        return;
                    }
                    // A negated probe states an ABSENCE — three of them are
                    // Three things the output must not carry, which no golden
                    // Of what it does carry can say.
                    if (PROBES.has(assertion.matcher) && !assertion.modifiers.includes('not')) {
                        probes.set(subject, (probes.get(subject) ?? 0) + 1);
                    }
                });
                for (const [subject, count] of probes) {
                    if (count >= threshold && !goldened.has(subject)) {
                        context.report({ data: { count, subject }, messageId: 'cluster', node });
                    }
                }
            },
        };
    },
    meta: {
        defaultOptions: [{ threshold: DEFAULT_THRESHOLD }],
        docs: RULE_DOCS['d19w-probe-cluster'],
        messages: {
            cluster:
                "{{count}} probes on `{{subject}}` — golden the subject: `expect({{subject}}).toMatch('<case>.txt')`, tokens for what moves.",
        },
        schema: [
            {
                additionalProperties: false,
                properties: { threshold: { minimum: 1, type: 'integer' } },
                type: 'object',
            },
        ],
        type: 'suggestion',
    },
};
