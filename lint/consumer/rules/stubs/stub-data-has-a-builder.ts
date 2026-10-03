import { defineRule, isFile, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';
import { dirname, join } from 'node:path';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf, segmentsOf } from '../../../kit/project/linted-file.js';
import { isStubKind } from '../../../kit/project/stub-kinds.js';
import { consumerRows } from '../../catalogue/manifest.js';

const REQUEST_DATA = /\.request\.[cm]?ts$/u;

function ownerOf(entry: string): string {
    return `${entry.slice(0, entry.indexOf('.'))}.ts`;
}

function kindOfRequestData(context: Context): string | undefined {
    const parts = segmentsOf(context);
    const entry = parts.at(-1) ?? '';
    const kind = parts.at(-2) ?? '';
    return identityOf(context).inSpecs &&
        REQUEST_DATA.test(entry) &&
        parts.at(-3) === 'stubs' &&
        isStubKind(kind)
        ? kind
        : undefined;
}

const row = rowNamed(consumerRows, 'stub-data-has-a-builder');

export const stubDataHasABuilder = defineRule(
    {
        docs: row,
        messages: {
            orphan: {
                found: '`_setup/stubs/{{kind}}/{{entry}}` has no stub beside it',
                fix: 'write `_setup/stubs/{{kind}}/{{owner}}` — the data pairs with the unit named by its stem, up to the first dot — or delete the orphan',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            let kind: string | undefined;
            return {
                before() {
                    kind = kindOfRequestData(context);
                    return kind !== undefined;
                },
                Program(node: AstNode) {
                    const file = context.physicalFilename;
                    const entry = segmentsOf(context).at(-1) ?? '';
                    const owner = ownerOf(entry);
                    if (!isFile(join(dirname(file), owner))) {
                        context.report({ data: { entry, kind, owner }, messageId: 'orphan', node });
                    }
                },
            };
        },
    },
);
