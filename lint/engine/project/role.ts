import { basename, dirname, join, relative } from 'node:path';

import { isProjectRoot, isUnderSpecs, segments } from './ast.js';
import { folderChanged, isFile } from './fs-cache.js';
import { GROUND_DIRS } from './ground.js';

/** The suffix decides the kind, and folders are read below the project root: a checkout under `fixtures/` or `__tests__/` is the machine's business. */

export type FileRole =
    | 'component'
    | 'config'
    | 'document'
    | 'ground'
    | 'module'
    | 'other'
    | 'spec'
    | 'specification'
    | 'stub';

export type StrayTestRoot = '__tests__' | 'test' | 'tests' | null;

export type FileIdentity = {
    inSpecs: boolean;
    strayTestRoot: StrayTestRoot;
    role: FileRole;
};

const GROUND = new Set<string>(GROUND_DIRS);

const CONFIG = /^vitest\.config\.[cm]?[jt]s$/u;

/** `__tests__/` anywhere; `test/` and `tests/` only directly under the project root, since a deeper `test` segment is an ordinary domain name. */
function strayTestRootOf(filename: string): StrayTestRoot {
    const parts = projectSegments(filename);
    if (parts.slice(0, -1).includes('__tests__')) {
        return '__tests__';
    }
    const first = parts.length > 1 ? parts[0] : undefined;
    if (projectRootOf(dirname(filename)) !== undefined && (first === 'tests' || first === 'test')) {
        return first;
    }
    return null;
}

/** The order matters: a `*.specification.ts` is one wherever it sits, and `.tsx` versus `.ts` tells a rendered unit apart as the two project helpers do. Ground swallows only what carries no suffix of its own. */
export function roleOf(filename: string): FileIdentity {
    const parts = projectSegments(filename);
    const base = parts.at(-1) ?? '';
    const identity = { inSpecs: isUnderSpecs(filename), strayTestRoot: strayTestRootOf(filename) };

    if (base.endsWith('.specification.ts') || base.endsWith('.specification.tsx')) {
        return { ...identity, role: 'specification' };
    }
    if (base.endsWith('.spec.yaml')) {
        return { ...identity, role: 'document' };
    }
    if (base.endsWith('.spec.ts')) {
        return { ...identity, role: 'spec' };
    }
    if (base.endsWith('.test.tsx')) {
        return { ...identity, role: 'component' };
    }
    if (base.endsWith('.test.ts')) {
        return { ...identity, role: 'module' };
    }
    if (CONFIG.test(base)) {
        return { ...identity, role: 'config' };
    }
    if (parts.slice(0, -1).some((segment) => GROUND.has(segment))) {
        return { ...identity, role: 'ground' };
    }
    if (parts.slice(0, -1).includes('stubs')) {
        return { ...identity, role: 'stub' };
    }
    return { ...identity, role: 'other' };
}

const TEST_ROLES = new Set<FileRole>(['component', 'module', 'spec']);

/** For the passes that walk a tree and hold only a name: one vocabulary with `roleOf`. */
export function isTestFileName(name: string): boolean {
    return name.endsWith('.test.ts') || name.endsWith('.test.tsx') || name.endsWith('.spec.ts');
}

/** A `.test.tsx` renders and is not one. */
export function isNodeTestFileName(name: string): boolean {
    return name.endsWith('.test.ts') || name.endsWith('.spec.ts');
}

export function isTestRole(role: FileRole): boolean {
    return TEST_ROLES.has(role);
}

export function isTestFile(filename: string): boolean {
    const { inSpecs, role } = roleOf(filename);
    return isTestRole(role) || role === 'specification' || role === 'document' || inSpecs;
}

export function directoryOf(filename: string): string {
    return dirname(filename);
}

export function packageRootOf(directory: string): string | undefined {
    let current = directory;
    for (;;) {
        if (isFile(join(current, 'package.json'))) {
            return current;
        }
        const parent = dirname(current);
        if (parent === current) {
            return undefined;
        }
        current = parent;
    }
}

const projectRoots = new Map<string, string | undefined>();

/** Remembered per folder, and forgotten for one directory once its own tree listing changes: a `package.json` written or removed there is what the memo must see. */
export function projectRootOf(directory: string): string | undefined {
    if (!folderChanged(directory) && projectRoots.has(directory)) {
        return projectRoots.get(directory);
    }
    let current = directory;
    for (;;) {
        if (isProjectRoot(current)) {
            projectRoots.set(directory, current);
            return current;
        }
        const parent = dirname(current);
        if (parent === current) {
            projectRoots.set(directory, undefined);
            return undefined;
        }
        current = parent;
    }
}

/** A path no package and no repository holds (a rule's test case, `/repo/…`) is read whole. */
export function projectSegments(filename: string): string[] {
    const root = projectRootOf(dirname(filename));
    return segments(root === undefined ? filename : relative(root, filename));
}

export function baseNameOf(filename: string): string {
    return basename(filename);
}
