import {
    child,
    childList,
    identifierName,
    memberPropertyName,
    stringValue,
} from '../../../kit/project/ast.js';
import type { AstNode } from '../../../kit/project/ast.js';

export function exportsDefault(node: AstNode): boolean {
    const specifiers = childList(node, 'specifiers');
    return specifiers.some((specifier) => {
        const exported = child(specifier, 'exported');
        return (
            (exported?.type === 'Identifier' && exported.name === 'default') ||
            stringValue(exported) === 'default'
        );
    });
}

const FACADE_SOURCE = /\.stubs(?:\.[cm]?[jt]s)?$/u;

const COMPOSITION_TYPE = 'Stubs';

function returnsComposition(fn: AstNode | undefined): boolean {
    const annotation = child(child(fn, 'returnType'), 'typeAnnotation');
    return (
        annotation?.type === 'TSTypeReference' &&
        identifierName(child(annotation, 'typeName')) === COMPOSITION_TYPE
    );
}

function facadeImports(node: AstNode): string[] {
    if (!FACADE_SOURCE.test(stringValue(child(node, 'source')) ?? '')) {
        return [];
    }
    return childList(node, 'specifiers').flatMap(
        (specifier) => identifierName(child(specifier, 'local')) ?? [],
    );
}

function compositionBuilder(node: AstNode): string | undefined {
    if (node.type === 'FunctionDeclaration') {
        return returnsComposition(node) ? identifierName(child(node, 'id')) : undefined;
    }
    if (node.type === 'VariableDeclarator') {
        return returnsComposition(child(node, 'init'))
            ? identifierName(child(node, 'id'))
            : undefined;
    }
    return undefined;
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
    const name = identifierName(value);
    return name !== undefined && names.has(name);
}

export function exportsByName(node: AstNode): boolean {
    if (node.exportKind === 'type') {
        return false;
    }
    if (node.type === 'ExportAllDeclaration') {
        return true;
    }
    return child(node, 'declaration') !== undefined || !exportsDefault(node);
}

export function composes(node: AstNode): boolean {
    if (node.type !== 'CallExpression') {
        return false;
    }
    const callee = child(node, 'callee');
    return (
        (callee?.type === 'Identifier' && callee.name === 'defineStubs') ||
        (callee !== undefined && memberPropertyName(callee) === 'with')
    );
}
