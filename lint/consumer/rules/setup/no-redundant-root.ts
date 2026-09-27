import {
    defineRule,
    holdsManifest,
    nearestRoot,
    readAt,
    rowNamed,
} from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';
import { dirname, resolve } from 'node:path';

import { findProperty, specificationMember, stringValue } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

function derivedRoot(startDir: string): string | undefined {
    return nearestRoot(startDir, holdsManifest);
}

const row = rowNamed(consumerRows, 'no-redundant-root');

export const noRedundantRoot = defineRule(
    {
        docs: row,
        messages: {
            redundant: {
                found: '`root: "{{root}}"` names the directory the walk already finds',
                fix: 'delete the `root` option',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'suggestion',
    },
    {
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
    },
);
