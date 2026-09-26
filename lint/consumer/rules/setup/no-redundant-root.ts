import type { Context } from '@oxlint/plugins';
import { dirname, resolve } from 'node:path';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import { findProperty, specificationMember, stringValue } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { isFile } from '../../../engine/project/fs-cache.js';
import { findRoot } from '../../../engine/project/resolve.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { consumerRows } from '../../catalogue/manifest.js';

/** The framework's own walk-up, run against this layer's fs probe: the rule and the runner must share one function. */
function derivedRoot(startDir: string): string | undefined {
    return findRoot(startDir, isFile);
}

export const noRedundantRoot: LintRule = {
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
        docs: rowNamed(consumerRows, 'no-redundant-root'),
        messages: lessonsAt(rowNamed(consumerRows, 'no-redundant-root'), {
            redundant: {
                found: '`root: "{{root}}"` names the directory the walk already finds',
                fix: 'delete the `root` option',
            },
        }),
        type: 'suggestion',
    },
};
