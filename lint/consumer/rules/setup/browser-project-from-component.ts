import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import { child, identifierName, propertyKeyName, walk } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

function isRunnerBrowserBlock(node: AstNode): boolean {
    for (
        let current = child(node, 'parent');
        current !== undefined;
        current = child(current, 'parent')
    ) {
        if (current.type === 'Property' && propertyKeyName(current) === 'test') {
            return true;
        }
    }
    return false;
}

function insideComponentCall(node: AstNode): boolean {
    for (
        let current = child(node, 'parent');
        current !== undefined;
        current = child(current, 'parent')
    ) {
        if (
            current.type === 'CallExpression' &&
            identifierName(child(current, 'callee')) === 'component'
        ) {
            return true;
        }
    }
    return false;
}

export const browserProjectFromComponent: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => identityOf(context).role === 'config',
            Program(node: AstNode) {
                walk(node, (candidate: AstNode) => {
                    if (candidate.type !== 'Property' || propertyKeyName(candidate) !== 'browser') {
                        return;
                    }
                    // A `browser` key elsewhere in a config (a `define` flag, an env record) is not a project's: the runner's sits under `test`.
                    if (!isRunnerBrowserBlock(candidate)) {
                        return;
                    }
                    if (!insideComponentCall(candidate)) {
                        context.report({ messageId: 'handRolled', node: candidate });
                    }
                });
            },
        };
    },
    meta: {
        docs: rowNamed(consumerRows, 'browser-project-from-component'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'browser-project-from-component'),
            {
                handRolled: {
                    found: 'a hand-rolled `browser:` block in a vitest config',
                    fix: "replace it with `component({ vite: './vite.config.ts' })`, which sets the provider, the worker and the pipeline",
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'problem',
    },
};
