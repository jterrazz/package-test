import { basename, dirname, join } from 'node:path';

import { childList, isNode } from './ast.js';
import { readFileCached } from './fs-cache.js';
import { parseProgram } from './module-parser.js';
import type { FileRole } from './role.js';
import type { AstNode } from './rule-shape.js';

/**
 * The title a test file's one `describe` carries (C31): a spec's ASPECT, a
 * colocated test's SUBJECT.
 *
 * The SUBJECT a colocated test names — the symbol of the module beside it
 * that the test is about, read from that module's exports.
 *
 * The rule, in order, the first that answers:
 *
 * 1. the name the sibling's default export declares;
 * 2. its one value export, when it has exactly one;
 * 3. the value export spelling the base name in camelCase or PascalCase
 *    (`route-judge` → `routeJudge`, `RouteJudge`);
 * 4. the base name itself, when no sibling answers.
 *
 * A value export is what a module hands at run time: a type, an interface, or
 * a specifier marked `type` is not one — a test calls what runs.
 */

/** The aspect a spec file names: `pagination.spec.ts` → `pagination`. */
export function aspectOf(filename: string): string {
    return basename(filename).replace(/\.spec\.ts$/u, '');
}

/** The file base a test is named for: `route-judge.test.ts` → `route-judge`. */
function testBaseOf(filename: string): string {
    return basename(filename).replace(/\.test\.tsx?$/u, '');
}

/** The sibling modules a test may cover, the extension of its own first. */
function siblingsOf(filename: string): string[] {
    const stem = join(dirname(filename), testBaseOf(filename));
    return filename.endsWith('.tsx')
        ? [`${stem}.tsx`, `${stem}.ts`]
        : [`${stem}.ts`, `${stem}.tsx`];
}

/** `route-judge` → `routeJudge`. */
function camelOf(base: string): string {
    return base.replaceAll(/[-_.]+(?<letter>\p{L}|\d)/gu, (_, letter: string) =>
        letter.toUpperCase(),
    );
}

/** The name an identifier node binds, when it is one. */
function nameOf(node: unknown): string | undefined {
    return isNode(node) && typeof node.name === 'string' ? node.name : undefined;
}

/** The value names one named export statement hands. */
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

/** The name the default export declares: `export default function judge…`, `export default Judge`. */
function defaultNameOf(statements: AstNode[]): string | undefined {
    const statement = statements.find((node) => node.type === 'ExportDefaultDeclaration');
    const declaration = statement?.declaration;
    return nameOf(declaration) ?? (isNode(declaration) ? nameOf(declaration.id) : undefined);
}

/** The subject a module's source names for the test of `base` (steps 1 to 4). */
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
    const camel = camelOf(base);
    const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
    return values.find((name) => name === camel || name === pascal) ?? base;
}

/** The subject of a colocated test: read from the module beside it, else its base name. */
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

/** What a test file's one `describe` is titled with, and the word the refusal calls it. */
export function testTitle(filename: string, role: FileRole): { named: string; what: string } {
    return role === 'spec'
        ? { named: aspectOf(filename), what: 'aspect' }
        : { named: subjectOf(filename), what: 'subject' };
}
