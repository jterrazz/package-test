import { basename, dirname, join, resolve } from 'node:path';

import { isGroundName } from '../src/model/chain/ground.js';
import { parseProgram } from '../src/seams/oxc-parser/parse.js';
import {
    child,
    childList,
    identifierName,
    importSourceVisitor,
    isNode,
    memberPropertyName,
    stringValue,
} from './ast.js';
import type { ImportSource } from './ast.js';
import { isFile, listDirectory, readFileCached } from './fs-cache.js';
import type { AstNode } from './oxlint-api.js';
import { mergeVisitors, pathReferenceVisitor, visitProgram } from './path-references.js';
import { packageRootOf, projectRootOf, projectSegments, roleOf } from './role.js';
import { withoutComments } from './subject.js';

/**
 * Production, and the test material it must never reach — ONE reader, for
 * every guard that keeps the two apart (F2, F5, I1).
 *
 * A **production module** is every source module that is not test material
 * itself — `src/`, `lint/`, `bin/`, `scripts/` and the modules at a project's
 * root alike — except a tool's config (`*.config.*`) and a module under a
 * retired test root (`__tests__/`, a root `test/` or `tests/`), which I2
 * refuses on its own.
 *
 * **Test material** is what a test is made of or stands on:
 *
 * - a test, a spec, a type test, a specification or a fixtures module, by
 *   its suffix;
 * - anything under a ground folder (`fixtures/`, `expected/`, `requests/`,
 *   `seeds/`) or under `specs/`;
 * - a contract: a `*.contracts.ts` facade, or anything under a `contracts/`
 *   folder that holds one;
 * - a test package: `@jterrazz/test` (its `/oxlint` tool entry aside),
 *   `vitest`, `@vitest/*`, `msw`, `@testing-library/*`, playwright.
 *
 * A module REFERENCES what it names in any of the forms {@link
 * moduleReferenceVisitor} reads; a reference REACHES test material when the
 * specifier is a test package, when it resolves — relatively, through a
 * tsconfig `paths` alias or through the package's `imports` map — to test
 * material, or when it resolves to a local module that is neither production
 * nor test material and reaches some in turn — that module parsed, so every
 * form it names a module or a path in is read as F2 reads a production one. A
 * production module on the way ends the walk: it is judged for its own
 * references.
 */

/** A source module, whatever its dialect. */
const SOURCE = /\.[cm]?[jt]sx?$/u;

/** The suffixes that make a module part of a test. */
const TEST_SUFFIX = /\.(?:test|spec|test-d|spec-d|specification|fixtures)\.[cm]?[jt]sx?$/u;

/** A contract facade — the file that makes its folder a contracts folder. */
const CONTRACTS_FACADE = /\.contracts\.[cm]?[jt]sx?$/u;

/** A tool's config — `vitest.config.ts`, `oxlint.config.ts`: the toolchain's, never shipped. */
const TOOL_CONFIG = /\.config\.[cm]?[jt]sx?$/u;

/** The test packages, by whole name. */
const TEST_PACKAGES = new Set([
    '@jterrazz/test',
    '@playwright/test',
    'msw',
    'playwright',
    'playwright-core',
    'vitest',
    'vitest-mock-extended',
]);

/** The test packages, by scope or by name prefix. */
const TEST_PACKAGE_PREFIXES = ['@testing-library/', '@vitest/', 'vitest-browser-'];

/** The one entry of a test package production may name: zero-runtime, tool-facing (F1). */
const TOOL_ENTRY = '@jterrazz/test/oxlint';

/** What a piece of test material is, as a message names it. */
export type MaterialKind =
    | 'a contract'
    | 'a test file'
    | 'a test package'
    | 'ground'
    | 'the specs tree';

/** Test material a reference reaches, and the modules it passed through to get there. */
export type Reach = {
    kind: MaterialKind;
    /** The local modules between the reference and the material, in order. */
    through: string[];
    /** The package name, or the path of the material. */
    what: string;
};

/** Does this folder hold a contract facade? */
function holdsFacade(directory: string): boolean {
    return (listDirectory(directory) ?? []).some((name) => CONTRACTS_FACADE.test(name));
}

/**
 * What test material this path is, read below its project root — `undefined`
 * for anything else. A `directory` path is judged as a folder: every segment
 * of it a folder, none of it a file name.
 */
export function materialAt(path: string, directory = false): MaterialKind | undefined {
    const parts = projectSegments(path);
    const folders = directory ? parts : parts.slice(0, -1);
    const base = directory ? '' : (parts.at(-1) ?? '');
    if (TEST_SUFFIX.test(base)) {
        return 'a test file';
    }
    if (folders.includes('specs')) {
        return 'the specs tree';
    }
    if (folders.some((folder) => isGroundName(folder))) {
        return 'ground';
    }
    if (CONTRACTS_FACADE.test(base)) {
        return 'a contract';
    }
    return inContractsFolder(directory ? path : dirname(path), folders);
}

/** Is a folder on this path a contracts folder — one holding a facade? */
function inContractsFolder(directory: string, folders: string[]): MaterialKind | undefined {
    const depth = folders.indexOf('contracts');
    if (depth === -1) {
        return undefined;
    }
    const root = projectRootOf(directory) ?? '/';
    return holdsFacade(join(root, ...folders.slice(0, depth + 1))) ? 'a contract' : undefined;
}

/** What test material a path a module builds names, read as a file or as a folder. */
export function materialNamed(path: string): MaterialKind | undefined {
    return materialAt(path) ?? materialAt(path, true);
}

/** Is this file a production module — a source module that is no test material, no config and under no retired test root? */
export function isProductionModule(filename: string): boolean {
    if (!SOURCE.test(filename) || materialAt(filename) !== undefined) {
        return false;
    }
    return !TOOL_CONFIG.test(basename(filename)) && roleOf(filename).legacyDir === null;
}

/** The test package a bare specifier names, when it names one. */
export function testPackageOf(specifier: string): string | undefined {
    if (specifier === TOOL_ENTRY) {
        return undefined;
    }
    const scoped = specifier.startsWith('@');
    const name = specifier
        .split('/')
        .slice(0, scoped ? 2 : 1)
        .join('/');
    if (TEST_PACKAGES.has(name)) {
        return name;
    }
    return TEST_PACKAGE_PREFIXES.some((prefix) => name.startsWith(prefix)) ? name : undefined;
}

/** The extensions a specifier may leave out, in the order a resolver tries them. */
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'];

/** The source a compiled specifier names (`./x.js` → `./x.ts`). */
const COMPILED: Record<string, string[]> = {
    '.cjs': ['.cts'],
    '.js': ['.ts', '.tsx'],
    '.jsx': ['.tsx'],
    '.mjs': ['.mts'],
};

/** The file a module path names on disk, or the path itself when none does. */
function onDisk(path: string): string {
    if (isFile(path)) {
        return path;
    }
    const extension = /\.[cm]?jsx?$/u.exec(path)?.[0];
    const candidates = [
        ...(COMPILED[extension ?? ''] ?? []).map(
            (swap) => path.slice(0, -(extension ?? '').length) + swap,
        ),
        ...EXTENSIONS.map((added) => path + added),
        ...EXTENSIONS.map((added) => join(path, `index${added}`)),
    ];
    return candidates.find((candidate) => isFile(candidate)) ?? path;
}

/** A JSON file with comments and trailing commas, as a value — `undefined` when it reads as none. */
function readJsonc(path: string): unknown {
    const text = readFileCached(path);
    if (text === null) {
        return undefined;
    }
    try {
        return JSON.parse(withoutComments(text).replaceAll(/,(?=\s*[\]}])/gu, '')) as unknown;
    } catch {
        return undefined;
    }
}

/** A record, or nothing. */
function recordOf(value: unknown): Record<string, unknown> | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return undefined;
    }
    return Object.fromEntries(Object.entries(value));
}

/** Every string a map target holds — a string, a condition object, an array of either. */
function targetsOf(value: unknown): string[] {
    if (typeof value === 'string') {
        return [value];
    }
    if (Array.isArray(value)) {
        return value.flatMap((entry) => targetsOf(entry));
    }
    return Object.values(recordOf(value) ?? {}).flatMap((entry) => targetsOf(entry));
}

/** What a map's key substitutes for a specifier — the one `*` it may carry — or `undefined`. */
function substitution(key: string, specifier: string): string | undefined {
    const star = key.indexOf('*');
    if (star === -1) {
        return key === specifier ? '' : undefined;
    }
    const head = key.slice(0, star);
    const tail = key.slice(star + 1);
    return specifier.startsWith(head) &&
        specifier.endsWith(tail) &&
        specifier.length >= head.length + tail.length
        ? specifier.slice(head.length, specifier.length - tail.length)
        : undefined;
}

/** The paths a map sends a specifier to, each resolved against `base`. */
function mapped(map: Record<string, unknown>, specifier: string, base: string): string[] {
    for (const [key, value] of Object.entries(map)) {
        const star = substitution(key, specifier);
        if (star !== undefined) {
            return targetsOf(value).map((target) => resolve(base, target.replace('*', star)));
        }
    }
    return [];
}

/** The nearest `tsconfig.json` at or above a directory, below the project root. */
function tsconfigOf(directory: string): string | undefined {
    const root = projectRootOf(directory);
    let current = directory;
    for (;;) {
        const candidate = join(current, 'tsconfig.json');
        if (isFile(candidate)) {
            return candidate;
        }
        const parent = dirname(current);
        if (current === root || parent === current) {
            return undefined;
        }
        current = parent;
    }
}

/** Where the tsconfig's `paths` send a bare specifier. */
function throughPaths(directory: string, specifier: string): string[] {
    const tsconfig = tsconfigOf(directory);
    if (tsconfig === undefined) {
        return [];
    }
    const options = recordOf(recordOf(readJsonc(tsconfig))?.compilerOptions);
    const paths = recordOf(options?.paths);
    if (paths === undefined) {
        return [];
    }
    const baseUrl = typeof options?.baseUrl === 'string' ? options.baseUrl : '.';
    return mapped(paths, specifier, resolve(dirname(tsconfig), baseUrl));
}

/** Where the package's `imports` map sends a `#…` specifier. */
function throughImports(directory: string, specifier: string): string[] {
    const root = packageRootOf(directory);
    if (root === undefined) {
        return [];
    }
    const manifest = recordOf(readJsonc(join(root, 'package.json')));
    const imports = recordOf(manifest?.imports);
    return imports === undefined ? [] : mapped(imports, specifier, root);
}

/**
 * The local files a specifier written in `from` names — one for a relative
 * specifier, the targets of the alias for an aliased one, none for a package.
 */
export function resolveSpecifier(from: string, specifier: string): string[] {
    const directory = dirname(from);
    if (specifier === '.' || specifier === '..' || /^\.\.?\//u.test(specifier)) {
        return [onDisk(resolve(directory, specifier))];
    }
    if (specifier.startsWith('/') || specifier.startsWith('node:')) {
        return [];
    }
    const targets = specifier.startsWith('#')
        ? throughImports(directory, specifier)
        : throughPaths(directory, specifier);
    return targets.map((target) => onDisk(target));
}

/** What a module names: the specifiers of its references, and the paths it builds or reads. */
type Named = { paths: string[]; specifiers: string[] };

/** What each module walked names, kept while its text is the one it was parsed from. */
const parsed = new Map<string, { named: Named; text: string }>();

/** What a module names, read from its parsed program — nothing when it does not parse. */
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
        pathReferenceVisitor(module, ({ path }) => {
            named.paths.push(path);
        }),
    );
    visitProgram(program, visitor);
    return named;
}

/** What a module that is neither production nor test material reaches, if anything. */
function reachThrough(module: string, seen: Set<string>): Reach | undefined {
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
        const reach = reachFrom(module, specifier, seen);
        if (reach !== undefined) {
            return { ...reach, through: [module, ...reach.through] };
        }
    }
    return undefined;
}

/** What one specifier written in `from` reaches, walking what `seen` has not. */
function reachFrom(from: string, specifier: string, seen: Set<string>): Reach | undefined {
    const name = testPackageOf(specifier);
    if (name !== undefined) {
        return { kind: 'a test package', through: [], what: name };
    }
    for (const target of resolveSpecifier(from, specifier)) {
        const kind = materialAt(target);
        if (kind !== undefined) {
            return { kind, through: [], what: target };
        }
    }
    for (const target of resolveSpecifier(from, specifier)) {
        if (SOURCE.test(target) && isFile(target) && !isProductionModule(target)) {
            const reach = reachThrough(target, seen);
            if (reach !== undefined) {
                return reach;
            }
        }
    }
    return undefined;
}

/** The test material a specifier written in `from` reaches, if it reaches any. */
export function reachOf(from: string, specifier: string): Reach | undefined {
    return reachFrom(from, specifier, new Set([from]));
}

/** The first string argument of a call, with the node that carries it. */
function firstString(node: AstNode): ImportSource | undefined {
    const [first] = childList(node, 'arguments');
    const source = stringValue(first);
    return first === undefined || source === undefined ? undefined : { node: first, source };
}

/** Is this `import.meta`? */
function isImportMeta(node: AstNode | undefined): boolean {
    return node?.type === 'MetaProperty';
}

/** Is this call's callee a `require`, a `require.resolve` or an `import.meta.resolve`? */
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

/**
 * Visitor fragment for every form a module names another in: a static import
 * or re-export (`import type` and `export *` included), `import()`, a type's
 * `import('…')`, `import x = require('…')`, `require()`, `require.resolve()`
 * and `import.meta.resolve()`.
 */
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
