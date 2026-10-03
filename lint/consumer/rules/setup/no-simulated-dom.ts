import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import type { FileRole } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

const PRAGMA = /@vitest-environment\s+(?<environment>[\w-]+)/u;

const SIMULATED = new Set(['happy-dom', 'jsdom']);

/** Only a role that runs a test file is steered by a pragma. */
const REACHED = new Set<FileRole>(['component', 'module', 'specification']);

const row = rowNamed(consumerRows, 'no-simulated-dom');

export const noSimulatedDom = defineRule(
    {
        docs: row,
        messages: {
            pragma: {
                found: '`@vitest-environment {{environment}}` simulates a browser',
                fix: 'delete the pragma, and write the rendered test as a `.test.tsx` beside its component, collected by the `component()` project',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
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
    },
);
