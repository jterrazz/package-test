import type { Context } from '@oxlint/plugins';

import { STUB_KINDS } from '../../../src/world/stubs/kinds.js';
import { importSourceVisitor } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { LintRule, Visitor } from '../../rule-shape.js';

/** A specifier reaching into a kind folder — the internal half of stubs/. */
const INTERNAL_UNIT = new RegExp(`(?:^|/)stubs/(?:${STUB_KINDS.join('|')})/`, 'u');

/**
 * CONVENTIONS C10 — the stubs boundary. A feature's `stubs/` folder has
 * a PUBLIC half (`*.stubs.ts` facades: the default export is the world, the
 * named exports are its scenarios) and an INTERNAL half (the unit stubs the
 * facades compose, one folder per stub kind). Outside `stubs/`,
 * importing a unit is an error — a test routes through the facade, so a
 * scenario is named once, next to the world it derives from.
 */
export const c10StubsBoundary: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            ...importSourceVisitor(({ node, source }) => {
                if (INTERNAL_UNIT.test(source)) {
                    context.report({ data: { source }, messageId: 'internal', node });
                }
            }),
            before() {
                const { inSpecs, role } = identityOf(context);
                // Inside stubs/ the internal half is the file's own business — and
                // that folder IS a role, so the rule asks the identity, not the path.
                return inSpecs && role !== 'stub';
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c10-stubs-boundary'],
        messages: lessons('c10-stubs-boundary', {
            internal: {
                found: 'the import "{{source}}" reaches into a stub kind folder',
                fix: 'export a named scenario from the `stubs/*.stubs.ts` facade, and import that',
            },
        }),
        type: 'problem',
    },
};
