import { lessonsAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import {
    child,
    childList,
    identifierName,
    memberPath,
    stringValue,
} from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isTestRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
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
        if (local === undefined) {
            continue;
        }
        if (specifier.type === 'ImportNamespaceSpecifier') {
            into.namespaces.add(local);
        } else if (
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
        imported?.type === 'ImportExpression' && stringValue(child(imported, 'source')) === 'vitest'
    );
}

function bindDynamicImport(declarator: AstNode, into: Bindings): void {
    if (!isVitestImport(child(declarator, 'init'))) {
        return;
    }
    const id = child(declarator, 'id');
    if (id?.type === 'Identifier') {
        into.namespaces.add(identifierName(id) ?? '');
        return;
    }
    for (const property of childList(id, 'properties')) {
        if (identifierName(child(property, 'key')) === 'expect') {
            into.expects.add(identifierName(child(property, 'value')) ?? 'expect');
        }
    }
}

function isBoundExpect(callee: AstNode | undefined, bound: Bindings): boolean {
    const [root = '', member, ...rest] = (memberPath(callee) ?? identifierName(callee) ?? '').split(
        '.',
    );
    return bound.expects.has(root)
        ? member === undefined || rest.length === 0
        : bound.namespaces.has(root) && member === 'expect';
}

export const noExpectOutsideATest: LintRule = {
    createOnce(context: Context): Visitor {
        const bound: Bindings = { expects: new Set(), namespaces: new Set() };
        return {
            before: () => {
                bound.expects.clear();
                bound.namespaces.clear();
                return assertsHere(context);
            },
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
    meta: {
        docs: rowNamed(consumerRows, 'no-expect-outside-a-test'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'no-expect-outside-a-test'),
            {
                expectOutsideATest: {
                    found: "vitest's `expect()` called in a file under `specs/` that is no test",
                    fix: 'return what the module reads, and assert it in the test that calls it',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'problem',
    },
};
