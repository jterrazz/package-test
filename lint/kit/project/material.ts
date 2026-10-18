import { isGroundFolder, listDirectory } from '@jterrazz/typescript/rules';
import { basename, dirname, join } from 'node:path';

import { projectRootOf, projectSegments, roleOf } from './role.js';

export const SOURCE = /\.[cm]?[jt]sx?$/u;

// outside: a `*.render.tsx` is a jest-expo test, which jest collects by its name; beside its component it is test material, never production.
const TEST_SUFFIX = /\.(?:test|spec|test-d|spec-d|specification|fixtures|render)\.[cm]?[jt]sx?$/u;

const STUBS_FACADE = /\.stubs\.[cm]?[jt]sx?$/u;

// outside: the toolchain's entry grammar names the source of a `./stubs` subpath `src/index.stubs.ts`: an entry at the source root, which no facade is.
const STUBS_ENTRY = 'index.stubs.ts';

// invariant: the toolchain's, never shipped.
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

function holdsFacade(directory: string): boolean {
    return (listDirectory(directory) ?? []).some((name) => STUBS_FACADE.test(name));
}

/** Read below the project root; a `directory` path is judged as a folder, none of it a file name. */
export function materialAt(path: string, directory = false): MaterialKind | undefined {
    const parts = projectSegments(path);
    const folders = directory ? parts : parts.slice(0, -1);
    const isNamed = (pattern: RegExp): boolean => !directory && pattern.test(basename(path));
    if (isNamed(TEST_SUFFIX)) {
        return 'a test file';
    }
    if (folders.includes('specs')) {
        return 'the specs tree';
    }
    if (folders.some((folder) => isGroundFolder(folder))) {
        return 'ground';
    }
    const isEntry = folders.length === 1 && folders[0] === 'src' && basename(path) === STUBS_ENTRY;
    if (isNamed(STUBS_FACADE) && !isEntry) {
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
    const { inTests, strayTestRoot } = roleOf(filename);
    return !TOOL_CONFIG.test(basename(filename)) && strayTestRoot === null && !inTests;
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
