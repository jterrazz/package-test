import type { Context } from '@oxlint/plugins';
import { dirname, join } from 'node:path';

import { GROUND_SEEDS } from '../../../src/kernel/files/ground.js';
import { lessons } from '../../catalogue/lesson.js';
import { RULE_DOCS } from '../../catalogue/manifest.js';
import type { AstNode } from '../../reading/ast.js';
import { listDirectory } from '../../reading/fs-cache.js';
import { identityOf } from '../../reading/linted-file.js';
import { isTestRole } from '../../reading/role.js';
import type { LintRule, Visitor } from '../rule.js';

/** Anchored on the visited test file, reading the listing of its sibling `seeds/`. */
export const c7SeedsSqlOnly: LintRule = {
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
        docs: RULE_DOCS['c7-seeds-sql-only'],
        messages: lessons('c7-seeds-sql-only', {
            notSql: {
                found: '`seeds/{{entry}}` is not a `.sql` file',
                fix: 'move it to `fixtures/` and lay it with `.fixture(file(…))`; `seeds/` holds database state only',
            },
        }),
        type: 'problem',
    },
};
