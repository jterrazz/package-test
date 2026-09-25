import type { Context } from '@oxlint/plugins';
import { dirname, resolve } from 'node:path';

import { findRoot } from '../../../src/kernel/files/resolve.js';
import { findProperty, specificationMember, stringValue } from '../../ast.js';
import { isFile } from '../../fs-cache.js';
import { lessons } from '../../lesson.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** The framework's own walk-up, run against this layer's fs probe: the rule and the runner must share one function. */
function derivedRoot(startDir: string): string | undefined {
    return findRoot(startDir, isFile);
}

export const a9wRedundantRoot: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            CallExpression(node: AstNode) {
                if (specificationMember(node) === undefined) {
                    return;
                }
                for (const argument of (node.arguments as AstNode[] | undefined) ?? []) {
                    const root = findProperty(argument, 'root');
                    const literal = stringValue(root?.value as AstNode | undefined);
                    if (root === undefined || literal === undefined) {
                        continue;
                    }
                    const specDir = dirname(context.physicalFilename);
                    if (resolve(specDir, literal) === derivedRoot(specDir)) {
                        context.report({
                            data: { root: literal },
                            messageId: 'redundant',
                            node: root,
                        });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['a9w-redundant-root'],
        messages: lessons('a9w-redundant-root', {
            redundant: {
                found: '`root: "{{root}}"` names the directory the walk already finds',
                fix: 'delete the `root` option',
            },
        }),
        type: 'suggestion',
    },
};
