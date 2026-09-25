import type { Context } from '@oxlint/plugins';
import { dirname, resolve } from 'node:path';

import { collectsAFile, projectLiterals, staticPrefix } from '../../config-shape.js';
import { isDirectory } from '../../fs-cache.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** The glob is checked too: a suffix renamed under a folder that still exists (C12's `--fix`) collects nothing as surely. */
export const e7wIncludePrefixExists: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => identityOf(context).role === 'config',
            Program(program: AstNode) {
                const configDirectory = dirname(context.physicalFilename);
                for (const project of projectLiterals(program)) {
                    for (const glob of project.include) {
                        const prefix = staticPrefix(glob.value);
                        const directory = resolve(configDirectory, prefix);
                        if (prefix !== '' && !isDirectory(directory)) {
                            context.report({
                                data: { glob: glob.value, prefix },
                                messageId: 'missingPrefix',
                                node: glob.node,
                            });
                            continue;
                        }
                        if (
                            collectsAFile(prefix === '' ? configDirectory : directory, glob.value)
                        ) {
                            continue;
                        }
                        context.report({
                            data: { glob: glob.value },
                            messageId: 'collectsNothing',
                            node: glob.node,
                        });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['e7w-include-prefix-exists'],
        messages: lessons('e7w-include-prefix-exists', {
            collectsNothing: {
                found: '`{{glob}}` matches no file, though its folder exists',
                fix: 'point the glob at the suffix the files carry now (`.spec.ts` after a rename), or delete it',
            },
            missingPrefix: {
                found: '`{{glob}}` collects nothing: the folder `{{prefix}}` does not exist',
                fix: 'point the glob at the folder that holds the suite, or delete it',
            },
        }),
        type: 'suggestion',
    },
};
