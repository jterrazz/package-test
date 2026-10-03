import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { importSourceVisitor } from '../../../kit/project/ast.js';
import type { Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { STUB_KINDS } from '../../../kit/project/stub-kinds.js';
import { consumerRows } from '../../catalogue/manifest.js';

const INTERNAL_UNIT = new RegExp(`(?:^|/)stubs/(?:${STUB_KINDS.join('|')})/`, 'u');

const row = rowNamed(consumerRows, 'stubs-imported-through-facade');

export const stubsImportedThroughFacade = defineRule(
    {
        docs: row,
        messages: {
            internal: {
                found: 'the import "{{source}}" reaches into a stub kind folder',
                fix: 'export a named scenario from the `_setup/stubs/*.stubs.ts` facade, and import that',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                ...importSourceVisitor(({ node, source }) => {
                    if (INTERNAL_UNIT.test(source)) {
                        context.report({ data: { source }, messageId: 'internal', node });
                    }
                }),
                before() {
                    const { inSpecs, role } = identityOf(context);
                    // Inside `_setup/stubs/` the internal half is the file's own business.
                    return inSpecs && role !== 'stub';
                },
            };
        },
    },
);
