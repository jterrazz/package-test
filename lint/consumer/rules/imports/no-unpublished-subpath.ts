import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import { importSourceVisitor } from '../../../engine/project/ast.js';
import type { Visitor } from '../../../engine/project/ast.js';
import { declaredSubpaths } from '../../../engine/project/package-exports.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

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
        docs: rowNamed(consumerRows, 'no-unpublished-subpath'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'no-unpublished-subpath'),
            {
                subpath: {
                    found: 'the import "{{source}}" names a subpath the package does not publish',
                    fix: 'import from "@jterrazz/test"; the published subpaths are {{published}}',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'problem',
    },
};
