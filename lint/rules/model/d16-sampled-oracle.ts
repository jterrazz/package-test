import type { Context } from '@oxlint/plugins';

import {
    assertionOf,
    child,
    childList,
    findTestCallback,
    isExpectCall,
    isSampledValue,
    isTestCallee,
    memberPath,
    walk,
} from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

const STRUCTURAL_MATCHERS = new Set(['toEqual', 'toMatch', 'toMatchObject', 'toStrictEqual']);

const PINS = new Set(['clock.advance', 'clock.at']);

function pinsTheClock(scope: AstNode): boolean {
    let pinned = false;
    walk(scope, (inner) => {
        if (inner.type !== 'CallExpression') {
            return;
        }
        const path = memberPath(child(inner, 'callee'));
        if (path !== undefined && PINS.has(path)) {
            pinned = true;
        }
    });
    return pinned;
}

function sampledUnder(node: AstNode | undefined): AstNode[] {
    if (node === undefined) {
        return [];
    }
    const found: AstNode[] = [];
    walk(node, (inner) => {
        if (isSampledValue(inner)) {
            found.push(inner);
        }
    });
    return found;
}

/** Deliberately narrow, the wider net is d16w's. A test pinning the clock is out of reach: its reading is a constant it chose. A specification may sample (a per-run label). */
export const d16SampledOracle: LintRule = {
    createOnce(context: Context): Visitor {
        const report = (found: AstNode[]): void => {
            for (const node of found) {
                context.report({ messageId: 'sampledOracle', node });
            }
        };
        return {
            before: () => isTestRole(identityOf(context).role),
            CallExpression(node: AstNode) {
                if (!isTestCallee(child(node, 'callee'))) {
                    return;
                }
                const callback = findTestCallback(childList(node, 'arguments'));
                if (callback === undefined || pinsTheClock(callback)) {
                    return;
                }
                walk(callback, (inner) => {
                    if (isExpectCall(inner)) {
                        report(childList(inner, 'arguments').filter(isSampledValue));
                        return;
                    }
                    const assertion = assertionOf(inner);
                    if (assertion === undefined) {
                        return;
                    }
                    const args = childList(inner, 'arguments');
                    report(
                        STRUCTURAL_MATCHERS.has(assertion.matcher)
                            ? args.flatMap((argument) => sampledUnder(argument))
                            : args.filter(isSampledValue),
                    );
                });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['d16-sampled-oracle'],
        messages: lessons('d16-sampled-oracle', {
            sampledOracle: {
                found: 'a sampled value under `expect`',
                fix: "pin it with `clock.at('2026-01-01T00:00:00Z')`, or match it with an `iso8601` token or `match.uuid`",
            },
        }),
        type: 'problem',
    },
};
