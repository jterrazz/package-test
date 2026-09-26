import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import { importSourceVisitor } from '../../../engine/project/ast.js';
import type { Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { STUB_KINDS } from '../../../engine/project/stub-kinds.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const INTERNAL_UNIT = new RegExp(`(?:^|/)stubs/(?:${STUB_KINDS.join('|')})/`, 'u');

export const stubsImportedThroughFacade: LintRule = {
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
    meta: {
        docs: rowNamed(consumerRows, 'stubs-imported-through-facade'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'stubs-imported-through-facade'),
            {
                internal: {
                    found: 'the import "{{source}}" reaches into a stub kind folder',
                    fix: 'export a named scenario from the `_setup/stubs/*.stubs.ts` facade, and import that',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'problem',
    },
};
