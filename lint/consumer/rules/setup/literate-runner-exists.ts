import { defineRule, isFile, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';
import { dirname, resolve } from 'node:path';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { literateRunners } from '../../../kit/project/config-shape.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { consumerRows } from '../../catalogue/manifest.js';

const row = rowNamed(consumerRows, 'literate-runner-exists');

/** The config states the path relative to itself, so the check is one `stat`. */
export const literateRunnerExists = defineRule(
    {
        docs: row,
        messages: {
            missing: {
                found: '`literate.runner` names `{{path}}`, which resolves to no file',
                fix: 'point it at the `*.specification.ts` exporting the runner the documents run on, `./specs/cli/cli.specification.ts` by convention',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                before: () => identityOf(context).role === 'config',
                Program(program: AstNode) {
                    const configDirectory = dirname(context.physicalFilename);
                    for (const door of literateRunners(program)) {
                        if (isFile(resolve(configDirectory, door.value))) {
                            continue;
                        }
                        context.report({
                            data: { path: door.value },
                            messageId: 'missing',
                            node: door.node,
                        });
                    }
                },
            };
        },
    },
);
