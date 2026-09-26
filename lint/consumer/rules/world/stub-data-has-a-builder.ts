import type { Context } from '@oxlint/plugins';
import { dirname, join } from 'node:path';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { listDirectory } from '../../../engine/project/fs-cache.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isTestRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { STUB_KINDS } from '../../../engine/project/stub-kinds.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const DATA_SUFFIXES = ['.request.ts', '.response.json'];

/** `events.fr.response.json` belongs to `events.ts`. */
function ownerOf(entry: string): string {
    return `${entry.slice(0, entry.indexOf('.'))}.ts`;
}

/** Reported on the feature's test file, since oxlint never visits a `.json`. */
export const stubDataHasABuilder: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before() {
                const { inSpecs, role } = identityOf(context);
                return isTestRole(role) && inSpecs;
            },
            Program(node: AstNode) {
                const stubsDir = join(dirname(context.physicalFilename), 'stubs');
                for (const kind of STUB_KINDS) {
                    const entries = listDirectory(join(stubsDir, kind));
                    if (entries === null) {
                        continue;
                    }
                    const present = new Set(entries);
                    for (const entry of entries) {
                        if (!DATA_SUFFIXES.some((suffix) => entry.endsWith(suffix))) {
                            continue;
                        }
                        const owner = ownerOf(entry);
                        if (!present.has(owner)) {
                            context.report({
                                data: { entry, kind, owner },
                                messageId: 'orphan',
                                node,
                            });
                        }
                    }
                }
            },
        };
    },
    meta: {
        docs: rowNamed(consumerRows, 'stub-data-has-a-builder'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'stub-data-has-a-builder'),
            {
                orphan: {
                    found: '`stubs/{{kind}}/{{entry}}` has no stub beside it',
                    fix: 'write `stubs/{{kind}}/{{owner}}` — data pairs with the unit named by its stem, up to the first dot — or delete the orphan',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'problem',
    },
};
