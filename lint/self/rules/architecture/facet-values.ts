import {
    child,
    childList,
    identifierName,
    propertyKeyName,
    stringValue,
} from '../../../reading/ast.js';
import type { AstNode } from '../../../reading/ast.js';

export function unwrapped(node: AstNode | undefined): AstNode | undefined {
    return node?.type === 'TSAsExpression' ||
        node?.type === 'TSSatisfiesExpression' ||
        node?.type === 'ParenthesizedExpression'
        ? unwrapped(child(node, 'expression'))
        : node;
}

export function isNamedKey(property: AstNode): boolean {
    return propertyKeyName(property) !== undefined;
}

export function isReference(node: AstNode | undefined): boolean {
    const read = unwrapped(node);
    return (
        read?.type === 'Identifier' ||
        (read?.type === 'MemberExpression' &&
            (read.computed !== true || stringValue(child(read, 'property')) !== undefined) &&
            isReference(child(read, 'object')))
    );
}

/** `config.jobs` → `config`. */
export function rootOf(node: AstNode | undefined): string | undefined {
    const read = unwrapped(node);
    return read?.type === 'MemberExpression' ? rootOf(child(read, 'object')) : identifierName(read);
}

/** `config.jobs ?? []` counts. */
function isPlainValue(node: AstNode | undefined): boolean {
    const value = unwrapped(node);
    return (
        isReference(value) ||
        value?.type === 'Literal' ||
        (value?.type === 'ArrayExpression' && childList(value, 'elements').every(isPlainValue)) ||
        (value?.type === 'LogicalExpression' &&
            isPlainValue(child(value, 'left')) &&
            isPlainValue(child(value, 'right')))
    );
}

function isEngineSource(source: string): boolean {
    return (
        (/(?:^|\/)world\//u.test(source) || /^\.\/[^/]+\/[^/]+\.js$/u.test(source)) &&
        !/\.(?:capability|action|facet|result)\.js$/u.test(source)
    );
}

export function isAdapter(
    node: AstNode | undefined,
    imports: ReadonlyMap<string, string>,
): boolean {
    const value = unwrapped(node);
    if (value?.type !== 'CallExpression' && value?.type !== 'NewExpression') {
        return isPlainValue(value);
    }
    const built = identifierName(child(value, 'callee'));
    return (
        built !== undefined &&
        isEngineSource(imports.get(built) ?? '') &&
        childList(value, 'arguments').every(isPlainValue)
    );
}

export function isRow(node: AstNode | undefined): boolean {
    const row = unwrapped(node);
    return (
        row?.type === 'ObjectExpression' &&
        childList(row, 'properties').every(
            (field) =>
                isNamedKey(field) && stringValue(unwrapped(child(field, 'value'))) !== undefined,
        )
    );
}
