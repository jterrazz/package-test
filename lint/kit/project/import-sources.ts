import { child, stringValue } from './ast.js';
import type { AstNode } from './ast.js';

export type ImportSource = { node: AstNode; source: string };

export function importSourceVisitor(
    onSource: (entry: ImportSource) => void,
): Record<string, (node: AstNode) => void> {
    const fromSourceField = (node: AstNode): void => {
        const source = child(node, 'source');
        const value = stringValue(source);
        if (value !== undefined) {
            onSource({ node: source ?? node, source: value });
        }
    };
    return {
        ExportAllDeclaration: fromSourceField,
        ExportNamedDeclaration: fromSourceField,
        ImportDeclaration: fromSourceField,
        ImportExpression: fromSourceField,
    };
}
