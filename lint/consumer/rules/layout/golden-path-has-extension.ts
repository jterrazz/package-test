import { lessonsAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { goldenOf } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isTestRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

/** A tree is `toMatch(directory(…))`, whose path ends in `/`: out of reach. */
export const goldenPathHasExtension: LintRule = {
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
        docs: rowNamed(consumerRows, 'golden-path-has-extension'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'golden-path-has-extension'),
            {
                missingExtension: {
                    found: '`toMatch(file("{{name}}"))` names a golden with no extension',
                    fix: 'add the extension to the path (`"./_expected/help.txt"`), or compare a tree with `toMatch(directory("./_expected/<name>/"))`',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'problem',
    },
};
