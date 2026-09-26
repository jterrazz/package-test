import type { Context } from '@oxlint/plugins';
import { dirname, resolve } from 'node:path';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { literateSpecifications } from '../../../engine/project/config-shape.js';
import { isFile } from '../../../engine/project/fs-cache.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

/** The config states the path relative to itself, so the check is one `stat`. */
export const literateSpecificationExists: LintRule = {
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
    meta: {
        docs: rowNamed(consumerRows, 'literate-specification-exists'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'literate-specification-exists'),
            {
                missing: {
                    found: '`literate.specification` names `{{path}}`, which resolves to no file',
                    fix: 'point it at the `*.specification.ts` exporting the runner the documents run on — `./specs/cli/cli.specification.ts` by convention',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'problem',
    },
};
