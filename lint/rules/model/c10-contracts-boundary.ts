import type { Context } from '@oxlint/plugins';

import { importSourceVisitor } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { LintRule, Visitor } from '../../rule-shape.js';

/** A specifier reaching into a provider folder — the internal half of contracts/. */
const INTERNAL_UNIT = /(?:^|\/)contracts\/(?:anthropic|http|openai)\//u;

/**
 * CONVENTIONS C10 — the contracts boundary. A feature's `contracts/` folder has
 * a PUBLIC half (`*.contracts.ts` facades: the default export is the world, the
 * named exports are its scenarios) and an INTERNAL half (the `http/`, `openai/`
 * and `anthropic/` unit contracts the facades compose). Outside `contracts/`,
 * importing a unit is an error — a test routes through the facade, so a
 * scenario is named once, next to the world it derives from.
 */
export const c10ContractsBoundary: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            ...importSourceVisitor(({ node, source }) => {
                if (INTERNAL_UNIT.test(source)) {
                    context.report({ data: { source }, messageId: 'internal', node });
                }
            }),
            before() {
                const { inSpecs, role } = identityOf(context);
                // Inside contracts/ the internal half is the file's own business — and
                // That folder IS a role, so the rule asks the identity, not the path.
                return inSpecs && role !== 'contract';
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c10-contracts-boundary'],
        messages: lessons('c10-contracts-boundary', {
            internal: {
                found: 'the import "{{source}}" reaches into a provider folder',
                fix: 'export a named scenario from the `contracts/*.contracts.ts` facade, and import that',
            },
        }),
        type: 'problem',
    },
};
