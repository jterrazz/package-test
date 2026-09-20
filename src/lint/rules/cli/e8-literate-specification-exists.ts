import { dirname, resolve } from 'node:path';

import { literateSpecifications } from '../../config-shape.js';
import { isFile } from '../../fs-cache.js';
import { RULE_DOCS } from '../../manifest.js';
import { roleOf } from '../../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../types.js';

/**
 * CONVENTIONS E8 — `literate.specification` names a file that exists.
 *
 * The literate door hands every `<case>.spec.yaml` to the runner exported by
 * that module; a path that resolves to nothing fails at collection time with a
 * message about an import, several layers away from the line that caused it.
 * The config states a path relative to itself, so the check is one `stat`.
 */
export const e8LiterateSpecificationExists: LintRule = {
    create(context: RuleContext): Visitor {
        if (roleOf(context.physicalFilename).role !== 'config') {
            return {};
        }
        const configDirectory = dirname(context.physicalFilename);
        return {
            Program(program: AstNode) {
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
        messages: {
            missing:
                '`literate.specification` must name the `*.specification.ts` exporting `cli` — `{{path}}` resolves to no file.',
        },
        type: 'problem',
    },
};
