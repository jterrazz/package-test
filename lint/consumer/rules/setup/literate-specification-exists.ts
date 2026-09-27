import { defineRule, isFile, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';
import { dirname, resolve } from 'node:path';

import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { literateSpecifications } from '../../../engine/project/config-shape.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const row = rowNamed(consumerRows, 'literate-specification-exists');

/** The config states the path relative to itself, so the check is one `stat`. */
export const literateSpecificationExists = defineRule(
    {
        docs: row,
        messages: {
            missing: {
                found: '`literate.specification` names `{{path}}`, which resolves to no file',
                fix: 'point it at the `*.specification.ts` exporting the runner the documents run on — `./specs/cli/cli.specification.ts` by convention',
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
                    for (const door of literateSpecifications(program)) {
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
