import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import type { AstNode } from '../../reading/ast.js';
import { identityOf } from '../../reading/linted-file.js';
import type { FileRole } from '../../reading/role.js';
import type { LintRule, Visitor } from '../rule.js';

const PRAGMA = /@vitest-environment\s+(?<environment>[\w-]+)/u;

const SIMULATED = new Set(['happy-dom', 'jsdom']);

/** Only a role that runs a test file is steered by a pragma. */
const REACHED = new Set<FileRole>(['component', 'module', 'specification']);

export const noSimulatedDom: LintRule = {
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
        docs: rowOf('no-simulated-dom'),
        messages: lessons('no-simulated-dom', {
            pragma: {
                found: '`@vitest-environment {{environment}}` simulates a browser',
                fix: 'delete the pragma, and write the rendered test as a `.test.tsx` beside its component, collected by the `component()` project',
            },
        }),
        type: 'problem',
    },
};
