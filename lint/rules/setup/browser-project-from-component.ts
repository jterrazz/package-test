import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import { child, identifierName, propertyKeyName, walk } from '../../reading/ast.js';
import type { AstNode, Visitor } from '../../reading/ast.js';
import { identityOf } from '../../reading/linted-file.js';
import type { LintRule } from '../rule.js';

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
        docs: rowOf('browser-project-from-component'),
        messages: lessons('browser-project-from-component', {
            handRolled: {
                found: 'a hand-rolled `browser:` block in a vitest config',
                fix: "replace it with `component({ vite: './vite.config.ts' })`, which sets the provider, the worker and the pipeline",
            },
        }),
        type: 'problem',
    },
};
