import { folderChanged, isFile, readFileCached } from '@jterrazz/typescript/rules';
import { dirname } from 'node:path';

import {
    child,
    childList,
    identifierName,
    isNode,
    memberPropertyName,
    stringValue,
} from './ast.js';
import type { AstNode } from './ast.js';
import { importSourceVisitor } from './import-sources.js';
import type { ImportSource } from './import-sources.js';
import {
    isProductionModule,
    materialAt,
    materialNamed,
    SOURCE,
    testPackageOf,
} from './material.js';
import type { MaterialKind } from './material.js';
import { parseProgram } from './module-parser.js';
import { mergeVisitors, pathReferenceVisitor, visitProgram } from './path-references.js';
import { packageRootOf } from './role.js';
import { resolveSpecifier } from './specifiers.js';
import { testSettingsAtSync } from './test-section.js';

export type Reach = {
    kind: MaterialKind;
    through: string[];
    what: string;
};

type Named = { paths: string[]; specifiers: string[] };

function namedIn(module: string, text: string): Named {
    // Stryker disable next-line ArrayDeclaration: a path or a specifier more that names nothing reaches nothing
    const named: Named = { paths: [], specifiers: [] };
    const program = parseProgram(module, text);
    if (!isNode(program)) {
        return named;
    }
    const visitor = mergeVisitors(
        moduleReferenceVisitor(({ source }) => {
            named.specifiers.push(source);
        }),
        pathReferenceVisitor(
            () => module,
            ({ path }) => {
                named.paths.push(path);
            },
        ),
    );
    visitProgram(program, visitor);
    return named;
}

function reachThrough(
    module: string,
    seen: Set<string>,
    allowed: ReadonlySet<string>,
): Reach | undefined {
    if (seen.has(module)) {
        return undefined;
    }
    seen.add(module);
    const text = readFileCached(module);
    // Stryker disable next-line ConditionalExpression,BlockStatement: a module is walked once it is a file, so its text is there
    if (text === null) {
        return undefined;
    }
    const { paths, specifiers } = namedIn(module, text);
    for (const path of paths) {
        const kind = materialNamed(path);
        if (kind !== undefined) {
            return { kind, through: [module], what: path };
        }
    }
    for (const specifier of specifiers) {
        const reach = reachFrom(module, specifier, seen, allowed);
        if (reach !== undefined) {
            return { ...reach, through: [module, ...reach.through] };
        }
    }
    return undefined;
}

/** A test package in `allowed` is one the unit's production runs by design. */
function reachFrom(
    from: string,
    specifier: string,
    seen: Set<string>,
    allowed: ReadonlySet<string>,
): Reach | undefined {
    const name = testPackageOf(specifier);
    if (name !== undefined) {
        return allowed.has(name) ? undefined : { kind: 'a test package', through: [], what: name };
    }
    for (const target of resolveSpecifier(from, specifier)) {
        const kind = materialAt(target);
        if (kind !== undefined) {
            return { kind, through: [], what: target };
        }
    }
    for (const target of resolveSpecifier(from, specifier)) {
        // Stryker disable next-line ConditionalExpression,LogicalOperator: a target that is no module source, or no file, names nothing when walked
        if (SOURCE.test(target) && isFile(target) && !isProductionModule(target)) {
            const reach = reachThrough(target, seen, allowed);
            if (reach !== undefined) {
                return reach;
            }
        }
    }
    return undefined;
}

export function allowedTestPackagesAt(filename: string): ReadonlySet<string> {
    const root = packageRootOf(dirname(filename));
    const allow = root === undefined ? undefined : testSettingsAtSync(root).production.allow;
    return new Set(Object.keys(allow ?? {}));
}

/** Per folder: a production module on the way ends the walk, so any module of one folder gets the same answer. A run ends when a file is linted again, a walked module is linted, or a folder's tree listing changes: that is how the editor's host is seen. */
const reaches = new Map<string, Reach | undefined>();

const linted = new Set<string>();

const walked = new Set<string>();

export function lintBegins(filename: string): void {
    if (linted.has(filename) || walked.has(filename) || folderChanged(dirname(filename))) {
        reaches.clear();
        // Stryker disable next-line CallExpression: a stale entry only ends the next run's memo early, never late
        linted.clear();
        // Stryker disable next-line CallExpression: a stale entry only ends the next run's memo early, never late
        walked.clear();
    }
    linted.add(filename);
}

export function reachOf(
    from: string,
    specifier: string,
    allowed: ReadonlySet<string> = new Set(),
): Reach | undefined {
    // Stryker disable next-line StringLiteral: no folder, specifier or package name spells another's join
    const key = [dirname(from), specifier, ...[...allowed].toSorted()].join('\0');
    if (reaches.has(key)) {
        return reaches.get(key);
    }
    // Stryker disable next-line ArrayDeclaration: the linted file is production, which no walk enters
    const seen = new Set([from]);
    const reach = reachFrom(from, specifier, seen, allowed);
    // Stryker disable next-line CallExpression: the linted file counted as walked only ends its run's memo early
    seen.delete(from);
    for (const module of seen) {
        walked.add(module);
    }
    reaches.set(key, reach);
    return reach;
}

function sourceAt(node: AstNode | undefined): ImportSource | undefined {
    const source = stringValue(node);
    if (source === undefined) {
        return undefined;
    }
    // Stryker disable next-line ConditionalExpression,BlockStatement: a source is read from a node, which is there
    if (node === undefined) {
        return undefined;
    }
    return { node, source };
}

function isRequireLike(callee: AstNode | undefined): boolean {
    if (identifierName(callee) === 'require') {
        return true;
    }
    if (memberPropertyName(callee) !== 'resolve') {
        return false;
    }
    const object = child(callee, 'object');
    // Stryker disable next-line OptionalChaining: a member always has an object
    return identifierName(object) === 'require' || object?.type === 'MetaProperty';
}

/** `import type`, `export *`, a type's `import('…')`, `import x = require('…')`, `require.resolve()` and `import.meta.resolve()` included. */
export function moduleReferenceVisitor(
    onReference: (entry: ImportSource) => void,
): Record<string, (node: AstNode) => void> {
    const report = (reference: ImportSource | undefined): void => {
        if (reference !== undefined) {
            onReference(reference);
        }
    };
    return {
        ...importSourceVisitor(onReference),
        CallExpression(node: AstNode) {
            const [first] = childList(node, 'arguments');
            report(isRequireLike(child(node, 'callee')) ? sourceAt(first) : undefined);
        },
        TSExternalModuleReference(node: AstNode) {
            report(sourceAt(child(node, 'expression')));
        },
        TSImportType(node: AstNode) {
            report(sourceAt(child(node, 'source')));
        },
    };
}
