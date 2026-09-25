import type { Context } from '@oxlint/plugins';

import { importSourceVisitor } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { RULE_DOCS } from '../../manifest.js';
import { declaredSubpaths } from '../../package-exports.js';
import type { LintRule, Visitor } from '../../rule-shape.js';

const PACKAGE = '@jterrazz/test';

/** The exception is the package's own `exports` map, read, not listed: a published subpath is the public contract. */
export const f1NoSubpathImport: LintRule = {
    createOnce(context: Context): Visitor {
        const allowed = new Set(declaredSubpaths());
        return {
            ...importSourceVisitor(({ node, source }) => {
                if (!source.startsWith(`${PACKAGE}/`) || allowed.has(source)) {
                    return;
                }
                context.report({
                    data: {
                        published: allowed.size === 0 ? 'none' : [...allowed].sort().join(', '),
                        source,
                    },
                    messageId: 'subpath',
                    node,
                });
            }),
        };
    },
    meta: {
        docs: RULE_DOCS['f1-no-subpath-import'],
        messages: lessons('f1-no-subpath-import', {
            subpath: {
                found: 'the import "{{source}}" names a subpath the package does not publish',
                fix: 'import from "@jterrazz/test"; the published subpaths are {{published}}',
            },
        }),
        type: 'problem',
    },
};
