import { isFile, lessonsAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';
import { dirname, join } from 'node:path';

import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf, segmentsOf } from '../../../engine/project/linted-file.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { isStubKind } from '../../../engine/project/stub-kinds.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
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

export const stubDataHasABuilder: LintRule = {
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
    meta: {
        docs: rowNamed(consumerRows, 'stub-data-has-a-builder'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'stub-data-has-a-builder'),
            {
                orphan: {
                    found: '`_setup/stubs/{{kind}}/{{entry}}` has no stub beside it',
                    fix: 'write `_setup/stubs/{{kind}}/{{owner}}` — the data pairs with the unit named by its stem, up to the first dot — or delete the orphan',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'problem',
    },
};
