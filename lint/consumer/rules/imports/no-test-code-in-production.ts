import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';
import { dirname, relative } from 'node:path';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import type { Visitor } from '../../../kit/project/ast.js';
import { isProductionFile } from '../../../kit/project/linted-file.js';
import { materialNamed } from '../../../kit/project/material.js';
import { mergeVisitors, pathReferenceVisitor } from '../../../kit/project/path-references.js';
import {
    allowedTestPackagesAt,
    lintBegins,
    moduleReferenceVisitor,
    reachOf,
} from '../../../kit/project/production.js';
import { consumerRows } from '../../catalogue/manifest.js';

const row = rowNamed(consumerRows, 'no-test-code-in-production');

export const noTestCodeInProduction = defineRule(
    {
        docs: row,
        messages: {
            pathRead: {
                found: 'production code names the path "{{path}}", {{kind}}',
                fix: 'move what production reads out of the test material, or have the caller hand it in',
            },
            reach: {
                found: 'production code references "{{source}}", {{kind}} ({{what}})',
                fix: 'move the reference into a test (specs, `*.test.ts`, `*.fixtures.ts` or `*.specification.ts`), or move what production needs out of the test material',
            },
            reachThrough: {
                found: 'production code references "{{source}}", which reaches {{kind}} ({{what}}) through {{through}}',
                fix: 'cut the edge that leaves production for test material: move what production needs out of it, or the reference into a test',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            let allowed: ReadonlySet<string> = new Set();
            const shown = (path: string): string =>
                relative(dirname(context.physicalFilename), path) || path;
            const references = moduleReferenceVisitor(({ node, source }) => {
                const reach = reachOf(context.physicalFilename, source, allowed);
                if (reach === undefined) {
                    return;
                }
                const what = reach.kind === 'a test package' ? reach.what : shown(reach.what);
                const data = { kind: reach.kind, source, what };
                if (reach.through.length > 0) {
                    const through = reach.through.map((module) => shown(module)).join(', then ');
                    context.report({ data: { ...data, through }, messageId: 'reachThrough', node });
                } else {
                    context.report({ data, messageId: 'reach', node });
                }
            });
            const paths = pathReferenceVisitor(
                () => context.physicalFilename,
                ({ node, path }) => {
                    const kind = materialNamed(path);
                    if (kind !== undefined) {
                        context.report({
                            data: { kind, path: shown(path) },
                            messageId: 'pathRead',
                            node,
                        });
                    }
                },
            );
            return {
                ...mergeVisitors(references, paths),
                before() {
                    // Stryker disable next-line CallExpression: the cache it clears only answers stale for a tree that changed mid-run, and no fixture tree does
                    lintBegins(context.physicalFilename);
                    if (!isProductionFile(context)) {
                        return false;
                    }
                    allowed = allowedTestPackagesAt(context.physicalFilename);
                    return true;
                },
            };
        },
    },
);
