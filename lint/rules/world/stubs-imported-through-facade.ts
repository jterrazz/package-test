import type { Context } from '@oxlint/plugins';

import { STUB_KINDS } from '../../../src/world/stubs/kinds.js';
import { lessons, rowOf } from '../../catalogue/lesson.js';
import { importSourceVisitor } from '../../reading/ast.js';
import type { Visitor } from '../../reading/ast.js';
import { identityOf } from '../../reading/linted-file.js';
import type { LintRule } from '../rule.js';

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
                // Inside `stubs/` the internal half is the file's own business.
                return inSpecs && role !== 'stub';
            },
        };
    },
    meta: {
        docs: rowOf('stubs-imported-through-facade'),
        messages: lessons('stubs-imported-through-facade', {
            internal: {
                found: 'the import "{{source}}" reaches into a stub kind folder',
                fix: 'export a named scenario from the `stubs/*.stubs.ts` facade, and import that',
            },
        }),
        type: 'problem',
    },
};
