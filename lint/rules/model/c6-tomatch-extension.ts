import type { Context } from '@oxlint/plugins';

import { goldenOf } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/**
 * CONVENTIONS C6 — the extension is part of a golden file's path and mandatory
 * in `toMatch(file(…))` (`'./expected/help.txt'`, never `'./expected/help'`). A
 * tree is `toMatch(directory(…))`, whose path ends in `/` — out of this rule's
 * reach.
 */
export const c6ToMatchExtension: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before() {
                const { inSpecs, role } = identityOf(context);
                return isTestRole(role) && inSpecs;
            },
            CallExpression(node: AstNode) {
                const golden = goldenOf(node);
                const name = golden?.kind === 'file' ? golden.path : undefined;
                if (golden === undefined || name === undefined || name.length === 0) {
                    return;
                }
                const base = name.split('/').at(-1) ?? '';
                if (base.includes('.')) {
                    return;
                }
                context.report({
                    data: { name },
                    messageId: 'missingExtension',
                    node: golden.node,
                });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c6-tomatch-extension'],
        messages: lessons('c6-tomatch-extension', {
            missingExtension: {
                found: '`toMatch(file("{{name}}"))` names a golden with no extension',
                fix: 'add the extension to the path (`"./expected/help.txt"`), or compare a tree with `toMatch(directory("./expected/<name>/"))`',
            },
        }),
        type: 'problem',
    },
};
