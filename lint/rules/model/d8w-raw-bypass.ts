import type { Context } from '@oxlint/plugins';

import { child, childList, identifierName, memberPropertyName } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** The value matcher that tempts a `.raw` bypass (D8). */
const TEXT_MATCHERS = new Set(['toContain']);

/** A regex literal, or `new RegExp(…)`. */
function isRegExp(node: AstNode | undefined): boolean {
    if (node === undefined) {
        return false;
    }
    if (node.type === 'Literal') {
        return 'regex' in node;
    }
    return node.type === 'NewExpression' && identifierName(child(node, 'callee')) === 'RegExp';
}

/**
 * CONVENTIONS D8 (warning) — `.raw` is the stream as it was captured, the
 * escape hatch for a test that proves what the comparison strips. Asserting
 * `expect(result.stdout.raw).toContain(…)` throws away what `.text` applies
 * before every comparison — ANSI stripping and the runner's transform.
 *
 * A RegExp argument is exempt: a pattern carries no token grammar to lose. A
 * negated check (`.not.toContain`) is read like the plain one.
 */
/** `expect(x).not` read as `expect(x)`: a negated check reads the capture as surely. */
function unnegated(node: AstNode | undefined): AstNode | undefined {
    return node !== undefined && memberPropertyName(node) === 'not' ? child(node, 'object') : node;
}

export const d8wRawBypass: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            CallExpression(node: AstNode) {
                const callee = node.callee as AstNode | undefined;
                const matcher = callee === undefined ? undefined : memberPropertyName(callee);
                if (matcher === undefined || !TEXT_MATCHERS.has(matcher)) {
                    return;
                }
                const expectCall = unnegated(callee?.object as AstNode | undefined);
                if (expectCall?.type !== 'CallExpression') {
                    return;
                }
                const expectCallee = expectCall.callee as AstNode | undefined;
                if (expectCallee?.type !== 'Identifier' || expectCallee.name !== 'expect') {
                    return;
                }
                if (isRegExp(childList(node, 'arguments')[0])) {
                    return;
                }
                const subject = (expectCall.arguments as AstNode[] | undefined)?.[0];
                if (subject !== undefined && memberPropertyName(subject) === 'raw') {
                    context.report({ data: { matcher }, messageId: 'rawBypass', node });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['d8w-raw-bypass'],
        messages: lessons('d8w-raw-bypass', {
            rawBypass: {
                found: '`expect(x.raw).{{matcher}}(…)` asserts on the stream as captured',
                fix: 'compare `x.text` — ANSI stripped, `transform` applied, the text an expectation compares',
            },
        }),
        type: 'suggestion',
    },
};
