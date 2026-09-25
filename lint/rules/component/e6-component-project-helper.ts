import type { Context } from '@oxlint/plugins';

import { child, identifierName, propertyKeyName, walk } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

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

export const e6ComponentProjectHelper: LintRule = {
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
        docs: RULE_DOCS['e6-component-project-helper'],
        messages: lessons('e6-component-project-helper', {
            handRolled: {
                found: 'a hand-rolled `browser:` block in a vitest config',
                fix: "replace it with `component({ vite: './vite.config.ts' })`, which sets the provider, the worker and the pipeline",
            },
        }),
        type: 'problem',
    },
};
