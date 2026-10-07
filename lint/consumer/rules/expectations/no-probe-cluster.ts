import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { assertionOf } from '../../../kit/project/assertions.js';
import { child, childList, memberPath, walk } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { goldenOf } from '../../../kit/project/framework-calls.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { findTestCallback, isTestCallee } from '../../../kit/project/test-calls.js';
import { consumerRows } from '../../catalogue/manifest.js';

const DEFAULT_THRESHOLD = 3;

// invariant: not `status` (`no-status-only-test`'s), nor `value` and `error`: single readings a golden would not improve.
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
    // Stryker disable next-line ConditionalExpression: no path holds no goldenable tail
    if (path === undefined) {
        return undefined;
    }
    const tail = path.slice(path.lastIndexOf('.') + 1);
    return GOLDENABLE.has(tail) ? path : undefined;
}

function thresholdOf(option: unknown): number {
    // Stryker disable ConditionalExpression: the schema admits only an object whose threshold is an integer
    const stated =
        typeof option === 'object' && option !== null && 'threshold' in option
            ? option.threshold
            : undefined;
    return typeof stated === 'number' ? stated : DEFAULT_THRESHOLD;
    // Stryker restore ConditionalExpression
}

const row = rowNamed(consumerRows, 'no-probe-cluster');

/** The threshold is an option: how many probes make a cluster is taste. A golden on the same subject silences it. */
export const noProbeCluster = defineRule(
    {
        defaultOptions: [{ threshold: DEFAULT_THRESHOLD }],
        docs: row,
        messages: {
            cluster: {
                found: '{{count}} probes on `{{subject}}`',
                fix: 'compare it whole — ``expect({{subject}}).toMatch(`…`)``, `TEST_UPDATE=1` writing the value — with tokens for what moves',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        schema: [
            {
                additionalProperties: false,
                properties: { threshold: { minimum: 1, type: 'integer' } },
                type: 'object',
            },
        ],
        type: 'suggestion',
    },
    {
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
                        // invariant: a negated probe states an absence, which no golden of what the output carries can say.
                        if (PROBES.has(assertion.matcher) && !assertion.modifiers.includes('not')) {
                            probes.set(subject, (probes.get(subject) ?? 0) + 1);
                        }
                    });
                    const threshold = thresholdOf(context.options[0]);
                    for (const [subject, count] of probes) {
                        if (count >= threshold && !goldened.has(subject)) {
                            context.report({
                                data: { count, subject },
                                messageId: 'cluster',
                                node,
                            });
                        }
                    }
                },
            };
        },
    },
);
