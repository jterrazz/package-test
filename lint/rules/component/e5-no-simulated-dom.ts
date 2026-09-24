import type { Context } from '@oxlint/plugins';

import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { FileRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** The pragma vitest reads to swap a test file's environment. */
const PRAGMA = /@vitest-environment\s+(?<environment>[\w-]+)/u;

/** The two simulated DOMs. */
const SIMULATED = new Set(['happy-dom', 'jsdom']);

/** The roles that RUN a test file — the only ones a pragma steers. */
const REACHED = new Set<FileRole>(['component', 'module', 'specification']);

/**
 * CONVENTIONS E5 — no simulated DOM, stated per file.
 *
 * `@vitest-environment happy-dom` buys a document that behaves almost like a
 * browser's: almost is the whole problem, because what ships is judged by a
 * real one. The component facet renders in the Chromium the website facet
 * already drives, so the pragma has nothing left to buy.
 */
export const e5NoSimulatedDom: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => REACHED.has(identityOf(context).role),
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
        messages: lessons('e5-no-simulated-dom', {
            pragma: {
                found: '`@vitest-environment {{environment}}` simulates a browser',
                fix: 'delete the pragma, and write the rendered test as a `.test.tsx` beside its component, collected by the `component()` project',
            },
        }),
        type: 'problem',
    },
};
