import type { Context } from '@oxlint/plugins';

import { lessons } from '../../catalogue/lesson.js';
import { RULE_DOCS } from '../../catalogue/manifest.js';
import { goldenOf } from '../../reading/ast.js';
import type { AstNode } from '../../reading/ast.js';
import { identityOf } from '../../reading/linted-file.js';
import { isTestRole } from '../../reading/role.js';
import type { LintRule, Visitor } from '../rule.js';

/** A tree is `toMatch(directory(…))`, whose path ends in `/`: out of reach. */
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
