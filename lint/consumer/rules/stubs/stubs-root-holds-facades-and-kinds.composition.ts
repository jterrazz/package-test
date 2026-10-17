import {
    child,
    childList,
    identifierName,
    memberPropertyName,
    stringValue,
} from '../../../kit/project/ast.js';
import type { AstNode } from '../../../kit/project/ast.js';

function exportedName(specifier: AstNode): string | undefined {
    const exported = child(specifier, 'exported');
    return identifierName(exported) ?? stringValue(exported);
}

export function exportsDefault(node: AstNode): boolean {
    return childList(node, 'specifiers').some((specifier) => exportedName(specifier) === 'default');
}

const FACADE_SOURCE = /\.stubs(?:\.[cm]?[jt]s)?$/u;

const COMPOSITION_TYPE = 'Stubs';

function returnsComposition(fn: AstNode | undefined): boolean {
    const annotation = child(child(fn, 'returnType'), 'typeAnnotation');
    return identifierName(child(annotation, 'typeName')) === COMPOSITION_TYPE;
}

function facadeImports(node: AstNode): string[] {
    if (!FACADE_SOURCE.test(stringValue(child(node, 'source')) ?? '')) {
        return [];
    }
    return childList(node, 'specifiers').flatMap(
        (specifier) => identifierName(child(specifier, 'local')) ?? [],
    );
}

// invariant: `function world(): Stubs` and `const world = (): Stubs => ...` alike.
function compositionBuilder(node: AstNode): string | undefined {
    const fn = node.type === 'VariableDeclarator' ? child(node, 'init') : node;
    return returnsComposition(fn) ? identifierName(child(node, 'id')) : undefined;
}

/** A sibling facade's named exports are scenarios, compositions by `stubs-root-holds-facades-and-kinds`. */
export function compositionNames(node: AstNode, names: Set<string>): void {
    const found =
        node.type === 'ImportDeclaration' ? facadeImports(node) : [compositionBuilder(node)];
    for (const name of found) {
        if (name !== undefined) {
            names.add(name);
        }
    }
}

export function namesComposition(
    declaration: AstNode | undefined,
    names: ReadonlySet<string>,
): boolean {
    const value =
        declaration?.type === 'CallExpression' ? child(declaration, 'callee') : declaration;
    return (names as ReadonlySet<unknown>).has(identifierName(value));
}

/** Called on an `export ... from`, `export * from` or `export { ... }`. */
export function exportsByName(node: AstNode): boolean {
    return (
        node.exportKind !== 'type' &&
        (node.type === 'ExportAllDeclaration' ||
            child(node, 'declaration') !== undefined ||
            childList(node, 'specifiers').some(
                (specifier) => exportedName(specifier) !== 'default',
            ))
    );
}

export function composes(node: AstNode): boolean {
    if (node.type !== 'CallExpression') {
        return false;
    }
    const callee = child(node, 'callee');
    return identifierName(callee) === 'defineStubs' || memberPropertyName(callee) === 'with';
}
