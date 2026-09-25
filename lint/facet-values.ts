import { child, childList, identifierName, propertyKeyName, stringValue } from './ast.js';
import type { AstNode } from './rule-shape.js';

/**
 * What a facet file may write as a value — a name, a literal, a matrix row,
 * a seam's constructor called on those — read off the node that writes it.
 * The facet file's findings (`facet-file.ts`) judge its members by them.
 */

/** The expression under the `as const` and `satisfies` it is written with. */
export function unwrapped(node: AstNode | undefined): AstNode | undefined {
    return node?.type === 'TSAsExpression' ||
        node?.type === 'TSSatisfiesExpression' ||
        node?.type === 'ParenthesizedExpression'
        ? unwrapped(child(node, 'expression'))
        : node;
}

/** Is the key a name written as it is — never a computed expression? */
export function isNamedKey(property: AstNode): boolean {
    return propertyKeyName(property) !== undefined;
}

/** An identifier, or a property read off one — a name, never logic. */
export function isReference(node: AstNode | undefined): boolean {
    const read = unwrapped(node);
    return (
        read?.type === 'Identifier' ||
        (read?.type === 'MemberExpression' &&
            (read.computed !== true || stringValue(child(read, 'property')) !== undefined) &&
            isReference(child(read, 'object')))
    );
}

/** The identifier a reference is read off: `config.jobs` → `config`. */
export function rootOf(node: AstNode | undefined): string | undefined {
    const read = unwrapped(node);
    return read?.type === 'MemberExpression' ? rootOf(child(read, 'object')) : identifierName(read);
}

/** A reference, a literal, a list of them, or one falling back to another (`config.jobs ?? []`). */
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

/** An adapter: a plain value, or a seam's constructor called (or `new`ed) on plain values. */
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
        /(?:^|\/)seams\//u.test(imports.get(built) ?? '') &&
        childList(value, 'arguments').every(isPlainValue)
    );
}

/** Is the option a matrix row written as string literals alone? */
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
