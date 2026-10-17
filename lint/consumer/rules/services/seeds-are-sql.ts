import {
    defineRule,
    GROUND_SEEDS,
    listDirectory,
    readAt,
    rowNamed,
} from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';
import { dirname, join } from 'node:path';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

const row = rowNamed(consumerRows, 'seeds-are-sql');

/** Anchored on the visited test file, reading the listing of its sibling `__seeds__/`. */
export const seedsAreSql = defineRule(
    {
        docs: row,
        messages: {
            notSql: {
                found: '`__seeds__/{{entry}}` is not a `.sql` file',
                fix: 'move it to `__fixtures__/` and lay it with `.fixture(file(...))`; `__seeds__/` holds database state only',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
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
    },
);
