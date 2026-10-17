import {
    folderChanged,
    GROUND_FOLDERS,
    holdsManifest,
    isProjectRoot,
    nearestRoot,
    TESTS_FOLDER,
} from '@jterrazz/typescript/rules';
import { basename, dirname, relative } from 'node:path';

import { SETTINGS_FILE } from './settings-file.js';
import { isUnderSpecs, segments } from './specs-anchor.js';

/** The suffix decides the kind, and folders are read below the project root: a checkout under `__fixtures__/` is the machine's business. */

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

export type StrayTestRoot = 'test' | 'tests' | null;

export type FileIdentity = {
    inSpecs: boolean;
    /** Under a `__tests__/` folder: a module test, the typed data it reads, its ground. */
    inTests: boolean;
    strayTestRoot: StrayTestRoot;
    role: FileRole;
};

const GROUND = new Set<string>(GROUND_FOLDERS);

// invariant: `test/` and `tests/` only directly under the project root, since a deeper `test` segment is an ordinary domain name.
function strayTestRootOf(filename: string): StrayTestRoot {
    const parts = projectSegments(filename);
    // Stryker disable next-line ConditionalExpression,EqualityOperator: no source file at the root is named test or tests
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
    const identity = {
        inSpecs: isUnderSpecs(filename),
        // Stryker disable next-line MethodExpression: no source file is named __tests__
        inTests: parts.slice(0, -1).includes(TESTS_FOLDER),
        strayTestRoot: strayTestRootOf(filename),
    };

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
    if (base === SETTINGS_FILE) {
        return { ...identity, role: 'config' };
    }
    // Stryker disable next-line MethodExpression: no file is named for a ground folder
    if (parts.slice(0, -1).some((segment) => GROUND.has(segment))) {
        return { ...identity, role: 'ground' };
    }
    // Stryker disable next-line MethodExpression: no file is named stubs
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

export function packageRootOf(directory: string): string | undefined {
    return nearestRoot(directory, holdsManifest);
}

const projectRoots = new Map<string, string | undefined>();

/** Remembered per folder, and forgotten for one directory once its own tree listing changes: a `package.json` written or removed there is what the memo must see. */
export function projectRootOf(directory: string): string | undefined {
    // Stryker disable next-line ConditionalExpression,BlockStatement: a memo missed is a root walked again, to the same answer
    if (!folderChanged(directory) && projectRoots.has(directory)) {
        return projectRoots.get(directory);
    }
    const root = nearestRoot(directory, isProjectRoot);
    // Stryker disable next-line CallExpression: a memo never kept is a root walked again, to the same answer
    projectRoots.set(directory, root);
    return root;
}

/** A path no package and no repository holds (a rule's test case, `/repo/...`) is read whole. A workspace member named `specs` is the specs tree itself, so its folder name stays the first segment of what it holds. */
export function projectSegments(filename: string): string[] {
    const root = projectRootOf(dirname(filename));
    if (root === undefined) {
        return segments(filename);
    }

    return [
        ...(basename(root) === 'specs' ? ['specs'] : []),
        ...segments(relative(root, filename)),
    ];
}
