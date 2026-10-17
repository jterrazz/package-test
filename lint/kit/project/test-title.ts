import { isFile, readFileCached, TESTS_FOLDER } from '@jterrazz/typescript/rules';
import { basename, dirname, join } from 'node:path';

import { child, childList, identifierName, isNode } from './ast.js';
import type { AstNode } from './ast.js';
import { parseProgram } from './module-parser.js';
import type { FileRole } from './role.js';
import { pathTemplate, subjectName, subjectsOf } from './subject.js';

/** `pagination.spec.ts` gives `pagination`. */
export function aspectOf(filename: string): string {
    // Stryker disable next-line Regex: a spec's name ends on its suffix
    return basename(filename).replace(/\.spec\.ts$/u, '');
}

/** `route-judge.test.ts` gives `route-judge`, `pagination.spec.ts` gives `pagination`. */
export function testBaseOf(filename: string): string {
    // Stryker disable next-line Regex: a test's name ends on its suffix
    return basename(filename).replace(/\.(?:test\.tsx?|spec\.ts)$/u, '');
}

// invariant: the folder of the module a test names: the one above its `__tests__/`, or its own for a rendered unit under `specs/`.
function moduleFolderOf(filename: string): string {
    const folder = dirname(filename);
    return basename(folder) === TESTS_FOLDER ? dirname(folder) : folder;
}

function modulesOf(filename: string): string[] {
    const stem = join(moduleFolderOf(filename), testBaseOf(filename));
    return filename.endsWith('.tsx')
        ? [`${stem}.tsx`, `${stem}.ts`]
        : [`${stem}.ts`, `${stem}.tsx`];
}

const ROLE_SUFFIX =
    /\.(?:action|adapter|capability|engine|composition|handle|port|project|result)$/u;

function camelOf(base: string): string {
    return base.replaceAll(/[-_.]+(?<letter>\p{L}|\d)/gu, (_, letter: string) =>
        letter.toUpperCase(),
    );
}

function namesOf(node: AstNode | undefined): string[] {
    const name = identifierName(node);
    return name === undefined ? [] : [name];
}

// invariant: a type, an interface and an ambient declaration are exported as types: no value a test calls. Any other statement names nothing it exports.
function valueExportsOf(statement: AstNode): string[] {
    if (statement.exportKind === 'type') {
        return [];
    }
    const declaration = child(statement, 'declaration');
    if (declaration === undefined) {
        return childList(statement, 'specifiers')
            .filter((specifier) => specifier.exportKind !== 'type')
            .flatMap((specifier) => namesOf(child(specifier, 'exported')));
    }
    if (declaration.type === 'VariableDeclaration') {
        return childList(declaration, 'declarations').flatMap((declarator) =>
            namesOf(child(declarator, 'id')),
        );
    }
    return namesOf(child(declaration, 'id'));
}

function defaultNameOf(statements: AstNode[]): string | undefined {
    const declaration = child(
        statements.find((node) => node.type === 'ExportDefaultDeclaration'),
        'declaration',
    );
    return identifierName(declaration) ?? identifierName(child(declaration, 'id'));
}

/** The first that answers: the default export's name; the one value export; the value export spelling the base in camelCase or PascalCase, or the base less a role suffix (`request.action` gives `request`); else the base, an `index` module's being its folder's name, the package entry's aside. A type is no value export: a test calls what runs. */
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
    const stem = testBaseOf(filename);
    const folder = moduleFolderOf(filename);
    const entry = isFile(join(dirname(folder), 'package.json'));
    const base = stem === 'index' && !entry ? basename(folder) : stem;
    for (const module of modulesOf(filename)) {
        const source = readFileCached(module);
        if (source !== null) {
            return subjectOfSource(base, source, module);
        }
    }
    return base;
}

export function testTitle(filename: string, role: FileRole): { named: string; what: string } {
    return role === 'spec'
        ? { named: aspectOf(filename), what: 'aspect' }
        : { named: subjectOf(filename), what: 'subject' };
}

const REACHING = /(?:^|\/)specs\/(?:api|website)\//u;

/** The pages a website spec visits and the routes an api spec requests, as it writes them (`/articles/:id`, `GET /articles/:id`): a title for the file's `describe` beside its name. */
export function reachedBy(filename: string, source: string): string[] {
    if (!REACHING.test(filename)) {
        return [];
    }

    return [
        ...new Set(
            subjectsOf(source).flatMap(({ subject }) =>
                subject.specification === 'website'
                    ? [subject.page]
                    : subject.specification === 'api'
                      ? [pathTemplate(subject.path), subjectName(subject)]
                      : [],
            ),
        ),
    ];
}
