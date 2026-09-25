import type { Context } from '@oxlint/plugins';

import {
    assertionOf,
    child,
    childList,
    findTestCallback,
    goldenOf,
    isTestCallee,
    memberPath,
    walk,
} from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

const DEFAULT_THRESHOLD = 3;

/** Not `status` (d15w's), nor `value` and `error`: single readings a golden would not improve. */
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

const PROBES = new Set(['toBe', 'toContain', 'toEqual', 'toMatch']);

function goldenableSubject(subject: AstNode | undefined): string | undefined {
    const path = memberPath(subject);
    if (path === undefined) {
        return undefined;
    }
    const tail = path.slice(path.lastIndexOf('.') + 1);
    return GOLDENABLE.has(tail) ? path : undefined;
}

function thresholdOf(option: unknown): number {
    const stated =
        typeof option === 'object' && option !== null && 'threshold' in option
            ? option.threshold
            : undefined;
    return typeof stated === 'number' ? stated : DEFAULT_THRESHOLD;
}

/** The threshold is an option: how many probes make a cluster is taste. A golden on the same subject silences it. */
export const d19wProbeCluster: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => isTestRole(identityOf(context).role),
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
                    if (goldenOf(inner) !== undefined) {
                        goldened.add(subject);
                        return;
                    }
                    // A negated probe states an absence, which no golden of what the output carries can say.
                    if (PROBES.has(assertion.matcher) && !assertion.modifiers.includes('not')) {
                        probes.set(subject, (probes.get(subject) ?? 0) + 1);
                    }
                });
                const threshold = thresholdOf(context.options[0]);
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
        messages: lessons('d19w-probe-cluster', {
            cluster: {
                found: '{{count}} probes on `{{subject}}`',
                fix: 'compare it whole — ``expect({{subject}}).toMatch(`…`)``, `TEST_UPDATE=1` writing the value — with tokens for what moves',
            },
        }),
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
