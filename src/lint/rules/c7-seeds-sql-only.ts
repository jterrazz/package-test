import { dirname, join } from 'node:path';

import { segments } from '../ast.js';
import { listDirectory } from '../fs-cache.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

/**
 * CONVENTIONS C7 — `.seed()` carries DATABASE state only: `seeds/` contains
 * nothing but `*.sql` fragments. File state goes through `.fixture()`; there
 * is no seed handler and no prefix dispatch. Anchored on the feature's visited
 * test file (cached readdir of the sibling `seeds/`).
 */
export const c7SeedsSqlOnly: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        if (!TEST_FILE.test(file) || !segments(file).includes('specs')) {
            return {};
        }
        return {
            Program(node: AstNode) {
                const seedsDir = join(dirname(file), 'seeds');
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
        messages: {
            notSql: 'seeds/{{entry}} is not a .sql file — seeds/ carries database state only; file state goes through .fixture() (C7 — see docs/10-linting.md).',
        },
        type: 'problem',
    },
};
