import { child, childList, stringValue } from './ast.js';
import type { AstNode } from './ast.js';

export type ImportSource = { json: boolean; node: AstNode; source: string };

const attributeText = (node: AstNode | undefined): string | undefined =>
    stringValue(node) ?? (node?.type === 'Identifier' ? String(node.name) : undefined);

// invariant: `with { type: 'json' }` is the import attribute that says the module is data a runtime parses, which is how an import names a JSON file honestly.
function isJsonImport(declaration: AstNode): boolean {
    return childList(declaration, 'attributes').some(
        (attribute) =>
            attributeText(child(attribute, 'key')) === 'type' &&
            stringValue(child(attribute, 'value')) === 'json',
    );
}

export function importSourceVisitor(
    onSource: (entry: ImportSource) => void,
): Record<string, (node: AstNode) => void> {
    const fromSourceField = (node: AstNode): void => {
        const source = child(node, 'source');
        const value = stringValue(source);
        if (value !== undefined) {
            onSource({ json: isJsonImport(node), node: source ?? node, source: value });
        }
    };
    return {
        ExportAllDeclaration: fromSourceField,
        ExportNamedDeclaration: fromSourceField,
        ImportDeclaration: fromSourceField,
        ImportExpression: fromSourceField,
    };
}
