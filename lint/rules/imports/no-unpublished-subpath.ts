import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import { importSourceVisitor } from '../../reading/ast.js';
import { declaredSubpaths } from '../../reading/package-exports.js';
import type { LintRule, Visitor } from '../rule.js';

const PACKAGE = '@jterrazz/test';

/** The exception is the package's own `exports` map, read, not listed: a published subpath is the public contract. */
export const noUnpublishedSubpath: LintRule = {
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
        docs: rowOf('no-unpublished-subpath'),
        messages: lessons('no-unpublished-subpath', {
            subpath: {
                found: 'the import "{{source}}" names a subpath the package does not publish',
                fix: 'import from "@jterrazz/test"; the published subpaths are {{published}}',
            },
        }),
        type: 'problem',
    },
};
