import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import {
    child,
    childList,
    identifierName,
    memberPath,
    stringValue,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

const TYPE_TEST = /\.test-d\.tsx?$/u;

function assertsHere(context: Context): boolean {
    const { inSpecs, role } = identityOf(context);
    return (
        inSpecs &&
        !isTestRole(role) &&
        role !== 'ground' &&
        !TYPE_TEST.test(context.physicalFilename)
    );
}

type Bindings = { expects: Set<string>; namespaces: Set<string> };

function bindImport(node: AstNode, into: Bindings): void {
    if (stringValue(child(node, 'source')) !== 'vitest') {
        return;
    }
    for (const specifier of childList(node, 'specifiers')) {
        const local = identifierName(child(specifier, 'local'));
        // Stryker disable next-line ConditionalExpression: an import's local name is always read
        if (local === undefined) {
            continue;
        }
        if (specifier.type === 'ImportNamespaceSpecifier') {
            into.namespaces.add(local);
        } else if (
            // Stryker disable next-line ConditionalExpression: only a named specifier names what it imports
            specifier.type === 'ImportSpecifier' &&
            identifierName(child(specifier, 'imported')) === 'expect'
        ) {
            into.expects.add(local);
        }
    }
}

function isVitestImport(init: AstNode | undefined): boolean {
    const imported = init?.type === 'AwaitExpression' ? child(init, 'argument') : init;
    return (
        // Stryker disable next-line ConditionalExpression: only an import expression has a source
        imported?.type === 'ImportExpression' && stringValue(child(imported, 'source')) === 'vitest'
    );
}

function bindDynamicImport(declarator: AstNode, into: Bindings): void {
    if (!isVitestImport(child(declarator, 'init'))) {
        return;
    }
    const id = child(declarator, 'id');
    // Stryker disable next-line OptionalChaining: a declarator always declares something
    if (id?.type === 'Identifier') {
        into.namespaces.add(identifierName(id) ?? '');
        return;
    }
    for (const property of childList(id, 'properties')) {
        if (identifierName(child(property, 'key')) === 'expect') {
            // Stryker disable next-line LogicalOperator,StringLiteral: a destructured property always binds a name
            into.expects.add(identifierName(child(property, 'value')) ?? 'expect');
        }
    }
}

function isBoundExpect(callee: AstNode | undefined, bound: Bindings): boolean {
    // Stryker disable next-line StringLiteral: a callee no name reaches binds nothing either way
    const [root = '', member, ...rest] = (memberPath(callee) ?? identifierName(callee) ?? '').split(
        '.',
    );
    return bound.expects.has(root)
        ? rest.length === 0
        : bound.namespaces.has(root) && member === 'expect';
}

const row = rowNamed(consumerRows, 'no-expect-outside-a-test');

export const noExpectOutsideATest = defineRule(
    {
        docs: row,
        messages: {
            expectOutsideATest: {
                found: "vitest's `expect()` called in a file under `specs/` that is no test",
                fix: 'return what the module reads, and assert it in the test that calls it',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            const bound: Bindings = { expects: new Set(), namespaces: new Set() };
            return {
                // Stryker disable BlockStatement,CallExpression: the bindings are a file's own, and the tester lints each case alone
                before: () => {
                    bound.expects.clear();
                    bound.namespaces.clear();
                    return assertsHere(context);
                },
                // Stryker restore BlockStatement,CallExpression
                ImportDeclaration(node: AstNode) {
                    bindImport(node, bound);
                },
                VariableDeclarator(node: AstNode) {
                    bindDynamicImport(node, bound);
                },
                CallExpression(node: AstNode) {
                    if (isBoundExpect(child(node, 'callee'), bound)) {
                        context.report({ messageId: 'expectOutsideATest', node });
                    }
                },
            };
        },
    },
);
