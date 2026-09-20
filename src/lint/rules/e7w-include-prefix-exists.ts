import { dirname, resolve } from 'node:path';

import { projectLiterals, staticPrefix } from '../config-shape.js';
import { isDirectory } from '../fs-cache.js';
import { RULE_DOCS } from '../manifest.js';
import { roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/**
 * CONVENTIONS E7w (warning) — an `include` whose static prefix is not a
 * directory collects nothing.
 *
 * A project that collects nothing PASSES: the run is green, the suite it was
 * supposed to run never executed, and the only trace is a zero nobody reads. A
 * folder renamed one commit earlier is all it takes, so the prefix is checked
 * against the filesystem the config sits in.
 */
export const e7wIncludePrefixExists: LintRule = {
    create(context: RuleContext): Visitor {
        if (roleOf(context.physicalFilename).role !== 'config') {
            return {};
        }
        const configDirectory = dirname(context.physicalFilename);
        return {
            Program(program: AstNode) {
                for (const project of projectLiterals(program)) {
                    for (const glob of project.include) {
                        const prefix = staticPrefix(glob.value);
                        if (prefix === '' || isDirectory(resolve(configDirectory, prefix))) {
                            continue;
                        }
                        context.report({
                            data: { glob: glob.value, prefix },
                            messageId: 'missingPrefix',
                            node: glob.node,
                        });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['e7w-include-prefix-exists'],
        messages: {
            missingPrefix: '`{{glob}}` collects nothing — the folder `{{prefix}}` does not exist.',
        },
        type: 'suggestion',
    },
};
