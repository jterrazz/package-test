import {
    blankComments,
    folderChanged,
    isFile,
    isGroundFolder,
    listDirectory,
    readFileCached,
} from '@jterrazz/typescript/rules';
import { basename, dirname, join, resolve } from 'node:path';

import {
    child,
    childList,
    identifierName,
    importSourceVisitor,
    isNode,
    memberPropertyName,
    stringValue,
} from './ast.js';
import type { AstNode, ImportSource } from './ast.js';
import { parseProgram } from './module-parser.js';
import { mergeVisitors, pathReferenceVisitor, visitProgram } from './path-references.js';
import { packageRootOf, projectRootOf, projectSegments, roleOf } from './role.js';
import { testSettingsAt } from './test-settings.js';

const SOURCE = /\.[cm]?[jt]sx?$/u;

const TEST_SUFFIX = /\.(?:test|spec|test-d|spec-d|specification|fixtures)\.[cm]?[jt]sx?$/u;

const STUBS_FACADE = /\.stubs\.[cm]?[jt]sx?$/u;

/** The toolchain's, never shipped. */
const TOOL_CONFIG = /\.config\.[cm]?[jt]sx?$/u;

const TEST_PACKAGES = new Set([
    '@jterrazz/test',
    '@playwright/test',
    'msw',
    'playwright',
    'playwright-core',
    'vitest',
    'vitest-mock-extended',
]);

const TEST_PACKAGE_PREFIXES = ['@testing-library/', '@vitest/', 'vitest-browser-'];

const TOOL_ENTRY = '@jterrazz/test/oxlint';

export type MaterialKind =
    | 'a stub'
    | 'a test file'
    | 'a test package'
    | 'ground'
    | 'the specs tree';

export type Reach = {
    kind: MaterialKind;
    through: string[];
    what: string;
};

function holdsFacade(directory: string): boolean {
    return (listDirectory(directory) ?? []).some((name) => STUBS_FACADE.test(name));
}

/** Read below the project root; a `directory` path is judged as a folder, none of it a file name. */
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
    if (folders.some((folder) => isGroundFolder(folder))) {
        return 'ground';
    }
    if (STUBS_FACADE.test(base)) {
        return 'a stub';
    }
    return inStubsFolder(directory ? path : dirname(path), folders);
}

function inStubsFolder(directory: string, folders: string[]): MaterialKind | undefined {
    const depth = folders.indexOf('stubs');
    if (depth === -1) {
        return undefined;
    }
    const root = projectRootOf(directory) ?? '/';
    return holdsFacade(join(root, ...folders.slice(0, depth + 1))) ? 'a stub' : undefined;
}

export function materialNamed(path: string): MaterialKind | undefined {
    return materialAt(path) ?? materialAt(path, true);
}

export function isProductionModule(filename: string): boolean {
    if (!SOURCE.test(filename) || materialAt(filename) !== undefined) {
        return false;
    }
    return !TOOL_CONFIG.test(basename(filename)) && roleOf(filename).strayTestRoot === null;
}

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

/** In the order a resolver tries them. */
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'];

/** `./x.js` → `./x.ts`. */
const COMPILED: Record<string, string[]> = {
    '.cjs': ['.cts'],
    '.js': ['.ts', '.tsx'],
    '.jsx': ['.tsx'],
    '.mjs': ['.mts'],
};

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

function readJsonc(path: string): unknown {
    const text = readFileCached(path);
    if (text === null) {
        return undefined;
    }
    try {
        return JSON.parse(blankComments(text).replaceAll(/,(?=\s*[\]}])/gu, '')) as unknown;
    } catch {
        return undefined;
    }
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return undefined;
    }
    return Object.fromEntries(Object.entries(value));
}

function targetsOf(value: unknown): string[] {
    if (typeof value === 'string') {
        return [value];
    }
    if (Array.isArray(value)) {
        return value.flatMap((entry) => targetsOf(entry));
    }
    return Object.values(recordOf(value) ?? {}).flatMap((entry) => targetsOf(entry));
}

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

function mapped(map: Record<string, unknown>, specifier: string, base: string): string[] {
    for (const [key, value] of Object.entries(map)) {
        const star = substitution(key, specifier);
        if (star !== undefined) {
            return targetsOf(value).map((target) => resolve(base, target.replace('*', star)));
        }
    }
    return [];
}

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

type PathsMap = { base: string; paths: Record<string, unknown> };

type Resolution = { baseUrl?: string; paths?: PathsMap };

/** In the compiler's order. */
function configCandidates(base: string): string[] {
    return [base, `${base}.json`, join(base, 'tsconfig.json')];
}

function extendedConfig(from: string, entry: string): string | undefined {
    const directory = dirname(from);
    if (entry.startsWith('.') || entry.startsWith('/')) {
        return configCandidates(resolve(directory, entry)).find((path) => isFile(path));
    }
    for (let current = directory; ; current = dirname(current)) {
        const found = configCandidates(join(current, 'node_modules', entry)).find((path) =>
            isFile(path),
        );
        if (found !== undefined || dirname(current) === current) {
            return found;
        }
    }
}

/** Folded the compiler's way: a later base overrides an earlier one, and `baseUrl` and `paths` resolve relative to the file stating them. */
function resolutionOf(tsconfig: string, seen: Set<string>): Resolution {
    if (seen.has(tsconfig)) {
        return {};
    }
    seen.add(tsconfig);
    const config = recordOf(readJsonc(tsconfig));
    const extended = config?.extends;
    const bases = typeof extended === 'string' ? [extended] : targetsOf(extended);
    const resolution: Resolution = {};
    for (const entry of bases) {
        const base = extendedConfig(tsconfig, entry);
        if (base !== undefined) {
            Object.assign(resolution, resolutionOf(base, seen));
        }
    }
    const options = recordOf(config?.compilerOptions);
    const directory = dirname(tsconfig);
    if (typeof options?.baseUrl === 'string') {
        resolution.baseUrl = resolve(directory, options.baseUrl);
    }
    const paths = recordOf(options?.paths);
    if (paths !== undefined) {
        resolution.paths = { base: directory, paths };
    }
    return resolution;
}

function throughPaths(directory: string, specifier: string): string[] {
    const tsconfig = tsconfigOf(directory);
    if (tsconfig === undefined) {
        return [];
    }
    const { baseUrl, paths } = resolutionOf(tsconfig, new Set());
    if (paths === undefined) {
        return [];
    }
    return mapped(paths.paths, specifier, baseUrl ?? paths.base);
}

function throughImports(directory: string, specifier: string): string[] {
    const root = packageRootOf(directory);
    if (root === undefined) {
        return [];
    }
    const manifest = recordOf(readJsonc(join(root, 'package.json')));
    const imports = recordOf(manifest?.imports);
    return imports === undefined ? [] : mapped(imports, specifier, root);
}

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
    const allow = root === undefined ? undefined : testSettingsAt(root).production.allow;
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
