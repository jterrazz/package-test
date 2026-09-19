import { RULE_DOCS } from '../manifest.js';
import { isTestFile } from '../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** The pragma vitest reads to swap a test file's environment. */
const PRAGMA = /@vitest-environment\s+(?<environment>[\w-]+)/u;

/** The two simulated DOMs a test file used to reach for. */
const SIMULATED = new Set(['happy-dom', 'jsdom']);

/**
 * CONVENTIONS E5 — no simulated DOM, stated per file.
 *
 * `@vitest-environment happy-dom` buys a document that behaves almost like a
 * browser's: almost is the whole problem, because what ships is judged by a
 * real one. The component facet renders in the Chromium the website facet
 * already drives, so the pragma has nothing left to buy.
 */
export const e5NoSimulatedDom: LintRule = {
    create(context: RuleContext): Visitor {
        if (!isTestFile(context.physicalFilename)) {
            return {};
        }
        return {
            Program(node: AstNode) {
                for (const comment of context.sourceCode.getAllComments()) {
                    const environment = PRAGMA.exec(comment.value)?.groups?.environment;
                    if (environment !== undefined && SIMULATED.has(environment)) {
                        context.report({ data: { environment }, messageId: 'pragma', node });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['e5-no-simulated-dom'],
        messages: {
            pragma: '`@vitest-environment {{environment}}` simulates a browser this framework can open for real — a rendered thing is a `.test.tsx` beside its component, collected by the `component()` project (E5 — docs/13-linting.md#e5-no-simulated-dom).',
        },
        type: 'problem',
    },
};
