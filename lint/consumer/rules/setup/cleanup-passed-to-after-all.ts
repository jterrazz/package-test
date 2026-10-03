import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { propertyKeyName, specificationMember, walk } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { consumerRows } from '../../catalogue/manifest.js';

function destructuresCleanup(node: AstNode): boolean {
    if (node.type !== 'VariableDeclarator') {
        return false;
    }
    let init = node.init as AstNode | undefined;
    while (init?.type === 'AwaitExpression') {
        init = init.argument as AstNode | undefined;
    }
    if (init?.type !== 'CallExpression' || specificationMember(init) === undefined) {
        return false;
    }
    const id = node.id as AstNode | undefined;
    if (id?.type !== 'ObjectPattern') {
        return false;
    }
    return ((id.properties as AstNode[] | undefined) ?? []).some(
        (property) => propertyKeyName(property) === 'cleanup',
    );
}

function isAfterAllWithCleanup(node: AstNode): boolean {
    if (node.type !== 'CallExpression') {
        return false;
    }
    const callee = node.callee as AstNode | undefined;
    if (callee?.type !== 'Identifier' || callee.name !== 'afterAll') {
        return false;
    }
    let found = false;
    for (const argument of (node.arguments as AstNode[] | undefined) ?? []) {
        walk(argument, (child) => {
            if (child.type === 'Identifier' && child.name === 'cleanup') {
                found = true;
            }
        });
    }
    return found;
}

const row = rowNamed(consumerRows, 'cleanup-passed-to-after-all');

export const cleanupPassedToAfterAll = defineRule(
    {
        docs: row,
        messages: {
            unregistered: {
                found: '`cleanup` is destructured and never handed to `afterAll`',
                fix: 'add `afterAll(cleanup);` at the end of the specification file',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                before: () => identityOf(context).role === 'specification',
                Program(node: AstNode) {
                    let cleanupDeclarator: AstNode | undefined;
                    let registered = false;
                    walk(node, (child) => {
                        if (cleanupDeclarator === undefined && destructuresCleanup(child)) {
                            cleanupDeclarator = child;
                        }
                        if (!registered && isAfterAllWithCleanup(child)) {
                            registered = true;
                        }
                    });
                    if (cleanupDeclarator !== undefined && !registered) {
                        context.report({ messageId: 'unregistered', node: cleanupDeclarator });
                    }
                },
            };
        },
    },
);
