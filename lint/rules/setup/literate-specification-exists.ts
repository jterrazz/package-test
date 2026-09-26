import type { Context } from '@oxlint/plugins';
import { dirname, resolve } from 'node:path';

import { lessons } from '../../catalogue/lesson.js';
import { RULE_DOCS } from '../../catalogue/manifest.js';
import type { AstNode } from '../../reading/ast.js';
import { literateSpecifications } from '../../reading/config-shape.js';
import { isFile } from '../../reading/fs-cache.js';
import { identityOf } from '../../reading/linted-file.js';
import type { LintRule, Visitor } from '../rule.js';

/** The config states the path relative to itself, so the check is one `stat`. */
export const e8LiterateSpecificationExists: LintRule = {
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
        docs: RULE_DOCS['e8-literate-specification-exists'],
        messages: lessons('e8-literate-specification-exists', {
            missing: {
                found: '`literate.specification` names `{{path}}`, which resolves to no file',
                fix: 'point it at the `*.specification.ts` exporting the runner the documents run on — `./specs/cli/cli.specification.ts` by convention',
            },
        }),
        type: 'problem',
    },
};
