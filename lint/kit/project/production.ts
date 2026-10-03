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

/** Kept while its text is the one it was parsed from. */
const parsed = new Map<string, { named: Named; text: string }>();

function namedIn(module: string, text: string): Named {
    const cached = parsed.get(module);
    if (cached?.text === text) {
        return cached.named;
    }
    const named: Named = { paths: [], specifiers: [] };
    parsed.set(module, { named, text });
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
        linted.clear();
        walked.clear();
    }
    linted.add(filename);
}

export function reachOf(
    from: string,
    specifier: string,
    allowed: ReadonlySet<string> = new Set(),
): Reach | undefined {
    const key = [dirname(from), specifier, ...[...allowed].toSorted()].join('\0');
    if (reaches.has(key)) {
        return reaches.get(key);
    }
    const seen = new Set([from]);
    const reach = reachFrom(from, specifier, seen, allowed);
    seen.delete(from);
    for (const module of seen) {
        walked.add(module);
    }
    reaches.set(key, reach);
    return reach;
}

function firstString(node: AstNode): ImportSource | undefined {
    const [first] = childList(node, 'arguments');
    const source = stringValue(first);
    return first === undefined || source === undefined ? undefined : { node: first, source };
}

function isImportMeta(node: AstNode | undefined): boolean {
    return node?.type === 'MetaProperty';
}

function isRequireLike(callee: AstNode | undefined): boolean {
    if (callee?.type === 'Identifier') {
        return identifierName(callee) === 'require';
    }
    if (callee === undefined || memberPropertyName(callee) !== 'resolve') {
        return false;
    }
    const object = child(callee, 'object');
    return identifierName(object) === 'require' || isImportMeta(object);
}

/** `import type`, `export *`, a type's `import('…')`, `import x = require('…')`, `require.resolve()` and `import.meta.resolve()` included. */
export function moduleReferenceVisitor(
    onReference: (entry: ImportSource) => void,
): Record<string, (node: AstNode) => void> {
    return {
        ...importSourceVisitor(onReference),
        CallExpression(node: AstNode) {
            const reference = isRequireLike(child(node, 'callee')) ? firstString(node) : undefined;
            if (reference !== undefined) {
                onReference(reference);
            }
        },
        TSExternalModuleReference(node: AstNode) {
            const expression = child(node, 'expression');
            const source = stringValue(expression);
            if (expression !== undefined && source !== undefined) {
                onReference({ node: expression, source });
            }
        },
        TSImportType(node: AstNode) {
            const argument = child(node, 'source') ?? child(node, 'argument');
            const literal =
                argument?.type === 'TSLiteralType' ? child(argument, 'literal') : argument;
            const source = stringValue(literal);
            if (literal !== undefined && source !== undefined) {
                onReference({ node: literal, source });
            }
        },
    };
}
