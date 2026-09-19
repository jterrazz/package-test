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

/** The node kinds a name sits in when it is a TYPE, not a value the test reaches. */
const TYPE_POSITIONS = new Set([
    'TSInterfaceHeritage',
    'TSQualifiedName',
    'TSTypeQuery',
    'TSTypeReference',
]);

/** Is this identifier read as a value, rather than named as a property, a key or a type? */
function isValueReference(node: AstNode): boolean {
    const parent = child(node, 'parent');
    if (parent === undefined) {
        return true;
    }
    if (TYPE_POSITIONS.has(parent.type)) {
        return false;
    }
    if (parent.type === 'UnaryExpression' && parent.operator === 'typeof') {
        // `typeof window === 'undefined'` REACHES no document: it is how a
        // Module states it runs in both runtimes, and the test of that guard
        // Is a module test by definition.
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

/**
 * CONVENTIONS G4 — a module test touches no DOM.
 *
 * A module test runs under node, where `document` does not exist: a test that
 * reaches for one is not testing a module, it is rendering something, and the
 * place for that is a `.test.tsx` beside the component.
 *
 * Reach is the `module` role OUTSIDE `specs/`: a `.test.tsx` is the rendered
 * kind and lives in a page, where those globals are what it is there to use;
 * and under `specs/` an api or cli spec is a `.test.ts` too until the `spec`
 * role exists, so the guard stops at the tree it can judge.
 *
 * A name in a TYPE position (`x as HTMLElement`) and a `typeof window` guard
 * name no document: neither reaches one, and a module that must run in both
 * runtimes is tested by exactly that guard.
 */
export const g4NoDomInModuleTest: LintRule = {
    create(context: RuleContext): Visitor {
        const identity = roleOf(context.physicalFilename);
        if (identity.role !== 'module' || identity.inSpecs) {
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
