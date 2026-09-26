import type { Context } from '@oxlint/plugins';
import { dirname, join } from 'node:path';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { listDirectory } from '../../../engine/project/fs-cache.js';
import { GROUND_SEEDS } from '../../../engine/project/ground.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isTestRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

/** Anchored on the visited test file, reading the listing of its sibling `_seeds/`. */
export const seedsAreSql: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before() {
                const { inSpecs, role } = identityOf(context);
                return isTestRole(role) && inSpecs;
            },
            Program(node: AstNode) {
                const seedsDir = join(dirname(context.physicalFilename), GROUND_SEEDS);
                for (const entry of listDirectory(seedsDir) ?? []) {
                    if (!entry.endsWith('.sql')) {
                        context.report({ data: { entry }, messageId: 'notSql', node });
                    }
                }
            },
        };
    },
    meta: {
        docs: rowNamed(consumerRows, 'seeds-are-sql'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'seeds-are-sql'),
            {
                notSql: {
                    found: '`_seeds/{{entry}}` is not a `.sql` file',
                    fix: 'move it to `_fixtures/` and lay it with `.fixture(file(…))`; `_seeds/` holds database state only',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'problem',
    },
};
