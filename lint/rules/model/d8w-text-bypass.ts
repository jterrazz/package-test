import { child, childList, identifierName, memberPropertyName } from '../../ast.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, RuleContext } from '../../oxlint-api.js';

/**
 * The text matcher that tempts a raw `.text` bypass (D8). `toMatch` is not one:
 * it is vitest's own, and a stream is compared through its text.
 */
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
 * CONVENTIONS D8 (warning) — `.text` is the raw stream escape hatch for a probe. Asserting
 * `expect(result.text).toContain(…)` throws away the typed subject (its ANSI
 * stripping, its transform) for a substring check. Prefer asserting on the
 * accessor subject itself.
 *
 * A RegExp argument is exempt: a pattern carries no token grammar to lose, so
 * the raw text and the accessor say the same thing.
 */
export const d8wTextBypass: LintRule = {
    create(context: RuleContext) {
        return {
            CallExpression(node: AstNode) {
                const callee = node.callee as AstNode | undefined;
                const matcher = callee === undefined ? undefined : memberPropertyName(callee);
                if (matcher === undefined || !TEXT_MATCHERS.has(matcher)) {
                    return;
                }
                const expectCall = callee?.object as AstNode | undefined;
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
                if (subject !== undefined && memberPropertyName(subject) === 'text') {
                    context.report({ data: { matcher }, messageId: 'textBypass', node });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['d8w-text-bypass'],
        messages: {
            textBypass:
                'expect(x.text).{{matcher}}(…) asserts on the raw stream — prefer the typed accessor subject (expect(x)) so the token grammar and fixture resolution apply.',
        },
        type: 'suggestion',
    },
};
