import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import type { FileRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { consumerRows } from '../../catalogue/manifest.js';

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
        docs: rowNamed(consumerRows, 'no-simulated-dom'),
        messages: lessonsAt(rowNamed(consumerRows, 'no-simulated-dom'), {
            pragma: {
                found: '`@vitest-environment {{environment}}` simulates a browser',
                fix: 'delete the pragma, and write the rendered test as a `.test.tsx` beside its component, collected by the `component()` project',
            },
        }),
        type: 'problem',
    },
};
