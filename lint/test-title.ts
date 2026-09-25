import { basename, dirname, join } from 'node:path';

import { childList, isNode } from './ast.js';
import { readFileCached } from './fs-cache.js';
import { parseProgram } from './module-parser.js';
import type { FileRole } from './role.js';
import type { AstNode } from './rule-shape.js';

/** The first that answers: the default export's name; the one value export; the value export spelling the base in camelCase or PascalCase, or the base less a role suffix (`request.action` → `request`); else the base. A type is no value export: a test calls what runs. */

/** `pagination.spec.ts` → `pagination`. */
export function aspectOf(filename: string): string {
    return basename(filename).replace(/\.spec\.ts$/u, '');
}

/** `route-judge.test.ts` → `route-judge`. */
function testBaseOf(filename: string): string {
    return basename(filename).replace(/\.test\.tsx?$/u, '');
}

function siblingsOf(filename: string): string[] {
    const stem = join(dirname(filename), testBaseOf(filename));
    return filename.endsWith('.tsx')
        ? [`${stem}.tsx`, `${stem}.ts`]
        : [`${stem}.ts`, `${stem}.tsx`];
}

const ROLE_SUFFIX = /\.(?:action|adapter|capability|engine|facet|handle|port|project|result)$/u;

function camelOf(base: string): string {
    return base.replaceAll(/[-_.]+(?<letter>\p{L}|\d)/gu, (_, letter: string) =>
        letter.toUpperCase(),
    );
}

function nameOf(node: unknown): string | undefined {
    return isNode(node) && typeof node.name === 'string' ? node.name : undefined;
}

function valueExportsOf(statement: AstNode): string[] {
    if (statement.type !== 'ExportNamedDeclaration' || statement.exportKind === 'type') {
        return [];
    }
    const { declaration } = statement;
    if (isNode(declaration)) {
        if (declaration.type === 'VariableDeclaration' && Array.isArray(declaration.declarations)) {
            return declaration.declarations
                .map((declarator: AstNode) => nameOf(declarator.id))
                .filter((name) => name !== undefined);
        }
        const typeOnly =
            declaration.type === 'TSTypeAliasDeclaration' ||
            declaration.type === 'TSInterfaceDeclaration' ||
            declaration.declare === true;
        const name = nameOf(declaration.id);
        return typeOnly || name === undefined ? [] : [name];
    }
    const specifiers = Array.isArray(statement.specifiers) ? statement.specifiers : [];
    return specifiers
        .filter((specifier: AstNode) => specifier.exportKind !== 'type')
        .map((specifier: AstNode) => nameOf(specifier.exported))
        .filter((name) => name !== undefined);
}

function defaultNameOf(statements: AstNode[]): string | undefined {
    const statement = statements.find((node) => node.type === 'ExportDefaultDeclaration');
    const declaration = statement?.declaration;
    return nameOf(declaration) ?? (isNode(declaration) ? nameOf(declaration.id) : undefined);
}

export function subjectOfSource(base: string, source: string, filename: string): string {
    const program = parseProgram(filename, source);
    const statements = isNode(program) ? childList(program, 'body') : [];
    const named = defaultNameOf(statements);
    if (named !== undefined) {
        return named;
    }
    const values = [...new Set(statements.flatMap((statement) => valueExportsOf(statement)))];
    if (values.length === 1) {
        return values[0] ?? base;
    }
    const spellings = [base, base.replace(ROLE_SUFFIX, '')].flatMap((stem) => {
        const camel = camelOf(stem);
        return [camel, camel.charAt(0).toUpperCase() + camel.slice(1)];
    });
    return spellings.find((spelling) => values.includes(spelling)) ?? base;
}

function subjectOf(filename: string): string {
    const base = testBaseOf(filename);
    for (const sibling of siblingsOf(filename)) {
        const source = readFileCached(sibling);
        if (source !== null) {
            return subjectOfSource(base, source, sibling);
        }
    }
    return base;
}

export function testTitle(filename: string, role: FileRole): { named: string; what: string } {
    return role === 'spec'
        ? { named: aspectOf(filename), what: 'aspect' }
        : { named: subjectOf(filename), what: 'subject' };
}
