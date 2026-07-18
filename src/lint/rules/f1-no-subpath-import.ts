import { importSourceVisitor } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import type { LintRule, RuleContext, Visitor } from '../types.js';

const PACKAGE = '@jterrazz/test';
const TOOL_SUBPATH = '@jterrazz/test/oxlint';

/**
 * CONVENTIONS F1 — everything is imported from `@jterrazz/test`; subpaths do
 * not exist. Sanctioned exception: `@jterrazz/test/oxlint`, the tool-facing,
 * zero-runtime plugin entry — exempt from any file (an oxlint config, a shared
 * preset, whatever wires the lint layer).
 */
export const f1NoSubpathImport: LintRule = {
    create(context: RuleContext) {
        const visitor: Visitor = {
            ...importSourceVisitor(({ node, source }) => {
                if (!source.startsWith(`${PACKAGE}/`)) {
                    return;
                }
                if (source === TOOL_SUBPATH) {
                    return;
                }
                context.report({ data: { source }, messageId: 'subpath', node });
            }),
        };
        return visitor;
    },
    meta: {
        docs: RULE_DOCS['f1-no-subpath-import'],
        messages: {
            subpath:
                'Import from "@jterrazz/test", not "{{source}}" — subpaths do not exist (F1 — see docs/10-linting.md; only the tool-facing @jterrazz/test/oxlint is exempt).',
        },
        type: 'problem',
    },
};
