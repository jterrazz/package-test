import {
    blankComments,
    filesUnder,
    isGroundFolder,
    PRUNED,
    treeEntries,
    treeKind,
} from '@jterrazz/typescript/rules';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';

import { isTestFileName } from './role.js';
import { SPEC_EXTENSION } from './spec-grammar.js';

/** A ground folder at the specs root holds what several specifications share. */
function isPool(dir: string): boolean {
    return isGroundFolder(basename(dir)) && basename(dirname(dir)) === 'specs';
}

export function specsRootOfPool(pool: string): string {
    return dirname(pool);
}

/** A fixture project with a `specs/` tree of its own is an input, judged where a spec runs the checker over it. */
function isPruned(dir: string): boolean {
    return PRUNED.has(basename(dir)) || isGroundFolder(basename(dir));
}

export function listFiles(dir: string, predicate: (path: string) => boolean): string[] {
    const out: string[] = [];
    const visit = (current: string): void => {
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(current, entry.name);
            if (entry.isDirectory()) {
                if (!isPruned(path)) {
                    visit(path);
                }
            } else if (predicate(path)) {
                out.push(path);
            }
        }
    };
    visit(dir);
    return out;
}

export function listDirs(dir: string): string[] {
    const out: string[] = [];
    const visit = (current: string): void => {
        out.push(current);
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(current, entry.name);
            if (entry.isDirectory() && !isPruned(path)) {
                visit(path);
            }
        }
    };
    visit(dir);
    return out;
}

export function findSpecsRoots(dir: string): string[] {
    const roots: string[] = [];
    const visit = (current: string): void => {
        if (basename(current) === 'specs') {
            roots.push(current);
            return;
        }
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.isDirectory() && !PRUNED.has(entry.name)) {
                visit(join(current, entry.name));
            }
        }
    };
    visit(dir);
    return roots;
}

export function findPools(dir: string): string[] {
    const pools: string[] = [];
    const visit = (current: string): void => {
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || PRUNED.has(entry.name)) {
                continue;
            }
            const path = join(current, entry.name);
            if (isPool(path)) {
                pools.push(path);
            } else if (!isGroundFolder(entry.name)) {
                visit(path);
            }
        }
    };
    visit(dir);
    return pools;
}

export function readText(path: string): string {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return '';
    }
}

export function readSource(path: string): string {
    return blankComments(readText(path));
}

/** A document counts: a rendered unit's ARIA golden sits in the same `__expected__/` as a spec's. */
export function isReferrer(name: string): boolean {
    return isTestFileName(name) || name.endsWith(SPEC_EXTENSION);
}

export function isDir(path: string): boolean {
    return treeKind(path) === 'directory';
}

export function columnAt(text: string, index: number): number {
    return index - text.lastIndexOf('\n', index - 1);
}

export function lineAt(text: string, index: number): number {
    return text.slice(0, index).split('\n').length;
}

export const DISK_CALL =
    /(?<![.\w])(?<kind>file|directory)\(\s*(?<quote>['"`])(?<path>(?:[^'"`\\]|\\.)*)\k<quote>/gu;

/** A path that is no folder holds no tests and lists no children: it is none. */
export function isConventionalSubdir(path: string): boolean {
    // invariant: a real ground folder holds leaf fixtures, never a test nor a nested ground folder.
    const files = listFiles(path, isTestFileName);
    if (files.length > 0) {
        return false;
    }
    let children;
    try {
        children = treeEntries(path);
    } catch {
        return false;
    }
    return !children.some((child) => child.isDirectory() && isGroundFolder(child.name));
}

export function listReaders(specsRoot: string): string[] {
    return listFiles(specsRoot, (path) => path.endsWith('.ts') || path.endsWith(SPEC_EXTENSION));
}

export function removeIfEmpty(folder: string): void {
    if (existsSync(folder) && readdirSync(folder).length === 0) {
        rmSync(folder, { recursive: true });
    }
}

export function isWithin(directory: string, path: string): boolean {
    const rest = relative(directory, path);
    return rest !== '' && !rest.startsWith('..') && !isAbsolute(rest);
}

export function lowestCommonFolder(folders: readonly string[]): string | undefined {
    const [first, ...others] = folders;
    // Stryker disable next-line ConditionalExpression,BlockStatement: none of an empty list fails the climb, which answers undefined too
    if (first === undefined) {
        return undefined;
    }
    let common = first;
    while (!others.every((folder) => folder === common || isWithin(common, folder))) {
        const parent = dirname(common);
        // Stryker disable next-line ConditionalExpression: only folders on no common root climb to the filesystem's, which none of a tree's are
        if (parent === common) {
            return undefined;
        }
        common = parent;
    }
    return common;
}

export function reservedFolderOf(owner: string, reserved: string): string {
    return join(owner, reserved);
}

export function decodeText(path: string): null | string {
    let text;
    try {
        text = readFileSync(path, 'utf8');
    } catch {
        return null;
    }
    // invariant: a NUL or a U+FFFD replacement char: a binary snapshot carries no token grammar.
    return text.includes('\u0000') || text.includes('\uFFFD') ? null : text;
}

export function sourcesUnder(dir: string, extensions: string[]): string[] {
    return filesUnder(dir)
        .filter((path) => !path.split('/').some((segment) => isGroundFolder(segment)))
        .filter((path) => extensions.some((extension) => path.endsWith(extension)))
        .map((path) => join(dir, path));
}
