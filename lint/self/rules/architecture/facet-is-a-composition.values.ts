import {
    child,
    childList,
    identifierName,
    isNamedKey,
    isReference,
    stringValue,
    unwrapped,
} from '../../../engine/project/ast.js';
import type { AstNode } from '../../../engine/project/ast.js';

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

function isDriverSource(source: string): boolean {
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
        isDriverSource(imports.get(built) ?? '') &&
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
