import { memberPropertyName, SCENARIO_ACTIONS, walk } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, Comment, LintRule, RuleContext } from '../types.js';

/** The invariant a `testId()` owes: what the element lacks, in the author's words. */
const REASON = /\/\/\s*testId:\s*\S/u;

/**
 * CONVENTIONS W2 — a scenario names what the USER sees (`button`, `link`,
 * `field`, `heading`, `content`; on mobile `button`, `field`, `content`).
 * `testId()` is the one escape hatch, and it does not come free: the line
 * states what the element LACKS — no accessible name, no role — so the next
 * reader knows whether the hatch is still needed or the markup was fixed.
 *
 * It is an invariant, not a rationale: the comment says what is true of the
 * element, which is why doctrine permits it where a "why" comment would not.
 *
 * The comment is accepted on the call's own line OR on the line directly
 * above. Consumers arm `eslint/no-inline-comments`, and a rule that demanded
 * the trailing form would put this convention and that one in direct conflict
 * — so the rule takes either, and the author takes whichever their config
 * allows.
 */
export const w2TestIdStatesWhatIsMissing: LintRule = {
    create(context: RuleContext) {
        const lines = context.sourceCode.text.split('\n');
        const comments = context.sourceCode.getAllComments();

        /** The 1-based line a node starts on, counted from its source offset. */
        const lineOf = (node: AstNode): number => {
            const offset = startOf(node);
            if (offset === undefined) {
                return 0;
            }
            return context.sourceCode.text.slice(0, offset).split('\n').length;
        };

        /** Does a `// testId: …` comment sit on this line, or on the one above it? */
        const stated = (line: number): boolean => {
            const own = lines[line - 1] ?? '';
            const above = lines[line - 2] ?? '';
            if (REASON.test(own) || REASON.test(above)) {
                return true;
            }
            // A comment the source text scan cannot see (a block form, or one
            // The formatter moved): ask the comment list for the same window.
            return comments.some((comment) => {
                const at = commentLine(context, comment);
                return (at === line || at === line - 1) && REASON.test(`//${comment.value}`);
            });
        };

        return {
            CallExpression(node: AstNode) {
                const callee = node.callee as AstNode | undefined;
                const member = callee ? memberPropertyName(callee) : undefined;
                if (member === undefined || !SCENARIO_ACTIONS.has(member)) {
                    return;
                }
                const args = node.arguments as AstNode[] | undefined;
                const scenario = args?.[1];
                if (
                    scenario?.type !== 'ArrowFunctionExpression' &&
                    scenario?.type !== 'FunctionExpression'
                ) {
                    return;
                }
                walk(scenario, (inner: AstNode) => {
                    if (inner.type !== 'CallExpression') {
                        return;
                    }
                    const innerCallee = inner.callee as AstNode | undefined;
                    if (innerCallee?.type !== 'Identifier' || innerCallee.name !== 'testId') {
                        return;
                    }
                    if (!stated(lineOf(inner))) {
                        context.report({ messageId: 'unexplainedTestId', node: inner });
                    }
                });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['w2-testid-states-what-is-missing'],
        messages: {
            unexplainedTestId:
                '`testId()` is the escape hatch: state what the element lacks with `// testId: <no accessible name|no role|…>` on this line or the one above, or name it with `button()`/`link()`/`field()`/`heading()`/`content()`.',
        },
        type: 'problem',
    },
};

/** A node's source offset, in either of the two shapes oxlint exposes. */
function startOf(node: AstNode): number | undefined {
    if (typeof node.start === 'number') {
        return node.start;
    }
    const range = node.range as [number, number] | undefined;
    return range?.[0];
}

/** The 1-based line a comment starts on. */
function commentLine(context: RuleContext, comment: Comment): number {
    const offset = comment.start ?? comment.range?.[0];
    if (offset === undefined) {
        return 0;
    }
    return context.sourceCode.text.slice(0, offset).split('\n').length;
}
