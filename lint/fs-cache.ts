import { readFileSync, statSync } from 'node:fs';

import { forgetTracked, trackedKind, trackedNames } from './tracked.js';

/**
 * Cached filesystem probes for the plugin's fs-anchored rules — every rule
 * that reads the tree beside the file oxlint visits — and the anchors they
 * stand on.
 *
 * A rule's evidence is read through the checker's tracked listing
 * (`tracked.ts`): inside a git work tree a file git does not track neither
 * satisfies nor violates a rule, and elsewhere the disk answers. The one
 * exception is {@link isOnDisk}, for what git never tracks by construction —
 * a repository's own `.git`.
 *
 * Rules only ever look at directories NEXT TO files oxlint is already
 * visiting (a feature's `requests/`, `seeds/`, `expected/`, a sibling module
 * file), so the probe set is small — but several rules probe the same feature
 * directory, and oxlint lints many files per process. A module-level cache
 * keeps each probe to one answer per lint run.
 */

const dirListings = new Map<string, null | string[]>();

/** The tracked children of `dir`, or null when it is not a directory. */
export function listDirectory(dir: string): null | string[] {
    const cached = dirListings.get(dir);
    if (cached !== undefined) {
        return cached;
    }
    let result: null | string[];
    try {
        result = trackedNames(dir);
    } catch {
        result = null;
    }
    dirListings.set(dir, result);
    return result;
}

const kinds = new Map<string, 'directory' | 'file' | undefined>();

function kindOf(path: string): 'directory' | 'file' | undefined {
    if (kinds.has(path)) {
        return kinds.get(path);
    }
    const result = trackedKind(path);
    kinds.set(path, result);
    return result;
}

export function isDirectory(path: string): boolean {
    return kindOf(path) === 'directory';
}

export function isFile(path: string): boolean {
    return kindOf(path) === 'file';
}

/** Is anything at `path` on disk, tracked or not — for `.git`, which git never lists. */
export function isOnDisk(path: string): boolean {
    try {
        statSync(path);
        return true;
    } catch {
        return false;
    }
}

const fileContents = new Map<string, null | string>();

/** Read a tracked file as UTF-8, cached. Returns null when untracked or unreadable (missing/binary). */
export function readFileCached(path: string): null | string {
    const cached = fileContents.get(path);
    if (cached !== undefined) {
        return cached;
    }
    let result: null | string = null;
    if (isFile(path)) {
        try {
            result = readFileSync(path, 'utf8');
        } catch {
            result = null;
        }
    }
    fileContents.set(path, result);
    return result;
}

/** Test seam: forget everything probed so far. */
export function resetFsCache(): void {
    dirListings.clear();
    kinds.clear();
    fileContents.clear();
    forgetTracked();
}
