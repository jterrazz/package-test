import type { Context } from '@oxlint/plugins';

import { lessons } from '../../catalogue/lesson.js';
import { RULE_DOCS } from '../../catalogue/manifest.js';
import { child, identifierName, isNode, walk } from '../../reading/ast.js';
import type { AstNode } from '../../reading/ast.js';
import { identityOf } from '../../reading/linted-file.js';
import type { LintRule, Visitor } from '../rule.js';

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

/** File-wide rather than a scope chain: it can only under-report, the right direction for a guard. */
function declaredNames(root: AstNode): Set<string> {
    const names = new Set<string>();
    const add = (node: AstNode | undefined): void => {
        const name = identifierName(node);
        if (name !== undefined) {
            names.add(name);
        }
    };
    walk(root, (node) => {
        const key = BINDINGS[node.type];
        if (key !== undefined) {
            add(child(node, key));
        }
        const { params } = node;
        if (Array.isArray(params)) {
            for (const parameter of params) {
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
    if (parent === undefined) {
        return true;
    }
    if (TYPE_POSITIONS.has(parent.type)) {
        return false;
    }
    if (parent.type === 'UnaryExpression' && parent.operator === 'typeof') {
        // `typeof window === 'undefined'` reaches no document: it is how a module states it runs in both runtimes.
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

/** Reach is the `module` role outside `specs/`: under `specs/` an api or cli spec is a `.test.ts` too. */
export const g4NoDomInModuleTest: LintRule = {
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
    meta: {
        docs: RULE_DOCS['g4-no-dom-in-module-test'],
        messages: lessons('g4-no-dom-in-module-test', {
            domGlobal: {
                found: '`{{name}}` in a module test, where no DOM exists',
                fix: 'move what renders into a `.test.tsx` beside its component, collected by the `component()` project',
            },
        }),
        type: 'problem',
    },
};
