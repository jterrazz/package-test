import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, identifierName, isNode, walk } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { consumerRows } from '../../catalogue/manifest.js';

const DOM_GLOBALS = new Set(['document', 'HTMLElement', 'navigator', 'window']);

const BINDINGS: Record<string, string> = {
    CatchClause: 'param',
    ClassDeclaration: 'id',
    FunctionDeclaration: 'id',
    ImportDefaultSpecifier: 'local',
    ImportNamespaceSpecifier: 'local',
    ImportSpecifier: 'local',
    VariableDeclarator: 'id',
};

// invariant: file-wide rather than a scope chain: it can only under-report, the right direction for a guard.
function declaredNames(root: AstNode): Set<string> {
    const names = new Set<string>();
    const add = (node: AstNode | undefined): void => {
        const name = identifierName(node);
        // Stryker disable next-line ConditionalExpression: undefined is no global's name
        if (name !== undefined) {
            names.add(name);
        }
    };
    walk(root, (node) => {
        const key = BINDINGS[node.type];
        // Stryker disable next-line ConditionalExpression: a node no binding names declares nothing under an undefined key
        if (key !== undefined) {
            add(child(node, key));
        }
        const { params } = node;
        if (Array.isArray(params)) {
            for (const parameter of params) {
                // Stryker disable next-line ConditionalExpression: a parameter is always a node
                if (isNode(parameter)) {
                    add(parameter);
                }
            }
        }
    });
    return names;
}

const TYPE_POSITIONS = new Set([
    'TSInterfaceHeritage',
    'TSQualifiedName',
    'TSTypeQuery',
    'TSTypeReference',
]);

function isValueReference(node: AstNode): boolean {
    const parent = child(node, 'parent');
    // Stryker disable next-line ConditionalExpression: an identifier always has a parent
    if (parent === undefined) {
        return true;
    }
    if (TYPE_POSITIONS.has(parent.type)) {
        return false;
    }
    // Stryker disable next-line ConditionalExpression: only a unary expression has `typeof` for its operator
    if (parent.type === 'UnaryExpression' && parent.operator === 'typeof') {
        // invariant: `typeof window === 'undefined'` reaches no document: it is how a module states it runs in both runtimes.
        return false;
    }
    if (parent.type === 'MemberExpression') {
        return child(parent, 'property') !== node || parent.computed === true;
    }
    if (parent.type === 'Property') {
        return child(parent, 'value') === node || parent.computed === true;
    }
    return true;
}

const row = rowNamed(consumerRows, 'no-dom-in-module-test');

/** Reach is the `module` role outside `specs/`: under `specs/` an api or cli spec is a `.test.ts` too. */
export const noDomInModuleTest = defineRule(
    {
        docs: row,
        messages: {
            domGlobal: {
                found: '`{{name}}` in a module test, where no DOM exists',
                fix: "move what renders into a `.test.tsx` in the `__tests__/` of its component's folder, collected by the `component()` project",
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            let declared = new Set<string>();
            return {
                before() {
                    const identity = identityOf(context);
                    return identity.role === 'module' && !identity.inSpecs;
                },
                Identifier(node: AstNode) {
                    const name = identifierName(node);
                    if (
                        // Stryker disable next-line ConditionalExpression: undefined is no global's name
                        name === undefined ||
                        !DOM_GLOBALS.has(name) ||
                        declared.has(name) ||
                        !isValueReference(node)
                    ) {
                        return;
                    }
                    context.report({ data: { name }, messageId: 'domGlobal', node });
                },
                Program(node: AstNode) {
                    declared = declaredNames(node);
                },
            };
        },
    },
);
