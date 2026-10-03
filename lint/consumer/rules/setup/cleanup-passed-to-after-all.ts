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
    // Stryker disable next-line ConditionalExpression,BlockStatement: no other node holds a call as its `init`
    if (node.type !== 'VariableDeclarator') {
        return false;
    }
    let init = child(node, 'init');
    while (init?.type === 'AwaitExpression') {
        init = child(init, 'argument');
    }
    // Stryker disable next-line ConditionalExpression: specificationMember reads no member from a non-call
    if (init?.type !== 'CallExpression' || specificationMember(init) === undefined) {
        return false;
    }
    const id = child(node, 'id');
    // Stryker disable next-line OptionalChaining,ConditionalExpression,BlockStatement: a declarator always declares something, and only a pattern lists properties
    if (id?.type !== 'ObjectPattern') {
        return false;
    }
    return childList(id, 'properties').some((property) => propertyKeyName(property) === 'cleanup');
}

function namesCleanup(argument: AstNode): boolean {
    let found = false;
    walk(argument, (visited) => {
        // Stryker disable next-line ConditionalExpression: only an identifier has a name
        if (visited.type === 'Identifier' && visited.name === 'cleanup') {
            found = true;
        }
    });
    return found;
}

function isAfterAllWithCleanup(node: AstNode): boolean {
    // Stryker disable next-line ConditionalExpression,BlockStatement: only a call has a callee
    if (node.type !== 'CallExpression') {
        return false;
    }
    const callee = child(node, 'callee');
    // Stryker disable next-line OptionalChaining,ConditionalExpression: a call always has a callee, and only an identifier has a name
    if (callee?.type !== 'Identifier' || callee.name !== 'afterAll') {
        return false;
    }
    return childList(node, 'arguments').some((argument) => namesCleanup(argument));
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
