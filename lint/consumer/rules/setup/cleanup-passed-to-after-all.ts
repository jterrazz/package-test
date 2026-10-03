import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import {
    child,
    childList,
    propertyKeyName,
    specificationMember,
    walk,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { consumerRows } from '../../catalogue/manifest.js';

function destructuresCleanup(node: AstNode): boolean {
    if (node.type !== 'VariableDeclarator') {
        return false;
    }
    let init = child(node, 'init');
    while (init?.type === 'AwaitExpression') {
        init = child(init, 'argument');
    }
    if (init?.type !== 'CallExpression' || specificationMember(init) === undefined) {
        return false;
    }
    const id = child(node, 'id');
    if (id?.type !== 'ObjectPattern') {
        return false;
    }
    return childList(id, 'properties').some((property) => propertyKeyName(property) === 'cleanup');
}

function isAfterAllWithCleanup(node: AstNode): boolean {
    if (node.type !== 'CallExpression') {
        return false;
    }
    const callee = child(node, 'callee');
    if (callee?.type !== 'Identifier' || callee.name !== 'afterAll') {
        return false;
    }
    let found = false;
    for (const argument of childList(node, 'arguments')) {
        walk(argument, (visited) => {
            if (visited.type === 'Identifier' && visited.name === 'cleanup') {
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
                    walk(node, (visited) => {
                        if (cleanupDeclarator === undefined && destructuresCleanup(visited)) {
                            cleanupDeclarator = visited;
                        }
                        if (!registered && isAfterAllWithCleanup(visited)) {
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
