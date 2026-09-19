import { child, identifierName, isNode, walk } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import { roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** The globals that only exist where a document does. */
const DOM_GLOBALS = new Set(['document', 'HTMLElement', 'navigator', 'window']);

/** The node kinds that BIND a name, and the key each one binds it under. */
const BINDINGS: Record<string, string> = {
    CatchClause: 'param',
    ClassDeclaration: 'id',
    FunctionDeclaration: 'id',
    ImportDefaultSpecifier: 'local',
    ImportNamespaceSpecifier: 'local',
    ImportSpecifier: 'local',
    VariableDeclarator: 'id',
};

/**
 * Every name this file declares for itself.
 *
 * A file-wide set rather than a scope chain: the rule only needs to know that
 * `document` is the test's own binding somewhere, and a name shadowed in one
 * scope is not a global in another. It can only under-report, which is the
 * right direction for a guard.
 */
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

/** Is this identifier read as a value, rather than named as a property or a key? */
function isValueReference(node: AstNode): boolean {
    const parent = child(node, 'parent');
    if (parent === undefined) {
        return true;
    }
    if (parent.type === 'MemberExpression') {
        return child(parent, 'property') !== node || parent.computed === true;
    }
    if (parent.type === 'Property') {
        return child(parent, 'value') === node || parent.computed === true;
    }
    return true;
}

/**
 * CONVENTIONS G4 — a module test touches no DOM.
 *
 * A module test runs under node, where `document` does not exist: a test that
 * reaches for one is not testing a module, it is rendering something. Before
 * the component facet the only way out was a simulated DOM, and a simulated DOM
 * proves the least of all — the thing it renders never met a browser. Now there
 * is somewhere for that test to go, and it is beside the component it renders.
 *
 * Reach is the `module` role only: a `.test.tsx` IS the rendered kind and lives
 * in a page, so the same globals are exactly what it is there to use.
 */
export const g4NoDomInModuleTest: LintRule = {
    create(context: RuleContext): Visitor {
        if (roleOf(context.physicalFilename).role !== 'module') {
            return {};
        }
        let declared = new Set<string>();
        return {
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
        messages: {
            domGlobal:
                '`{{name}}` does not exist where a module test runs — a rendered thing is a `.test.tsx` beside its component, collected by the `component()` project (G4 — docs/13-linting.md#g4-no-dom-in-module-test).',
        },
        type: 'problem',
    },
};
