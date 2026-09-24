import type { Context } from '@oxlint/plugins';
import { dirname, resolve } from 'node:path';

import { literateSpecifications } from '../../config-shape.js';
import { isFile } from '../../fs-cache.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/**
 * CONVENTIONS E8 — `literate.specification` names a file that exists.
 *
 * The literate door hands every `<case>.spec.yaml` to the runner exported by
 * that module; a path that resolves to nothing fails at collection time with a
 * message about an import, several layers away from the line that caused it.
 * The config states a path relative to itself, so the check is one `stat`.
 */
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
