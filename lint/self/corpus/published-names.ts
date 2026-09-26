import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { isNode } from '../../engine/project/ast.js';
import type { AstNode } from '../../engine/project/ast.js';
import { parseProgram } from '../../engine/project/module-parser.js';

/** A name is what a consumer's import spells, so the surface is recorded by name, whatever the build does behind it. */

export const PUBLISHED_ENTRIES = ['dist/index.d.ts', 'dist/browser/index.js', 'dist/vitest.d.ts'];

function nameOf(node: unknown): string | undefined {
    if (!isNode(node)) {
        return undefined;
    }
    if (typeof node.name === 'string') {
        return node.name;
    }
    return typeof node.value === 'string' ? node.value : undefined;
}

function exportsOf(statement: AstNode): string[] {
    if (statement.type === 'ExportDefaultDeclaration') {
        return ['default'];
    }
    if (statement.type === 'ExportAllDeclaration') {
        const name = nameOf(statement.exported);
        if (name === undefined) {
            throw new Error('`export *` without a name publishes what another module holds');
        }
        return [name];
    }
    if (statement.type !== 'ExportNamedDeclaration') {
        return [];
    }
    const specifiers = Array.isArray(statement.specifiers) ? statement.specifiers : [];
    const named = specifiers.map((specifier: AstNode) => nameOf(specifier.exported));
    const { declaration } = statement;
    if (!isNode(declaration)) {
        return named.filter((name) => name !== undefined);
    }
    const declared =
        declaration.type === 'VariableDeclaration' && Array.isArray(declaration.declarations)
            ? declaration.declarations.map((declarator: AstNode) => nameOf(declarator.id))
            : [nameOf(declaration.id)];
    return [...named, ...declared].filter((name) => name !== undefined);
}

export function exportedNames(root: string, path: string): string[] {
    const program = parseProgram(path, readFileSync(resolve(root, path), 'utf8'));
    if (!isNode(program) || !Array.isArray(program.body)) {
        throw new Error(`${path} does not parse`);
    }
    const names = new Set(program.body.flatMap((statement: AstNode) => exportsOf(statement)));
    return [...names].toSorted();
}

export function renderPublishedNames(root: string): string {
    const blocks = PUBLISHED_ENTRIES.map((path) =>
        [`${path}:`, ...exportedNames(root, path).map((name) => `    ${name}`)].join('\n'),
    );
    return `${blocks.join('\n\n')}\n`;
}
