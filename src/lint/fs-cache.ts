import { readdirSync, readFileSync, statSync } from 'node:fs';

/**
 * Cached filesystem probes for the fs-anchored rules (a9w, c2, c6, c7, i2).
 *
 * Rules only ever look at directories NEXT TO files oxlint is already
 * visiting (a feature's `requests/`, `seeds/`, `expected/`, a sibling module
 * file), so the probe set is small — but several rules probe the same feature
 * directory, and oxlint lints many files per process. A module-level cache
 * keeps each `readdir`/`stat` to one syscall per lint run.
 */

const dirListings = new Map<string, null | string[]>();

export function listDirectory(dir: string): null | string[] {
    const cached = dirListings.get(dir);
    if (cached !== undefined) {
        return cached;
    }
    let result: null | string[];
    try {
        result = readdirSync(dir);
    } catch {
        result = null;
    }
    dirListings.set(dir, result);
    return result;
}

const kinds = new Map<string, 'dir' | 'file' | 'missing'>();

function kindOf(path: string): 'dir' | 'file' | 'missing' {
    const cached = kinds.get(path);
    if (cached !== undefined) {
        return cached;
    }
    let result: 'dir' | 'file' | 'missing';
    try {
        result = statSync(path).isDirectory() ? 'dir' : 'file';
    } catch {
        result = 'missing';
    }
    kinds.set(path, result);
    return result;
}

export function isDirectory(path: string): boolean {
    return kindOf(path) === 'dir';
}

export function isFile(path: string): boolean {
    return kindOf(path) === 'file';
}

const fileContents = new Map<string, null | string>();

/** Read a file as UTF-8, cached. Returns null when unreadable (missing/binary). */
export function readFileCached(path: string): null | string {
    const cached = fileContents.get(path);
    if (cached !== undefined) {
        return cached;
    }
    let result: null | string;
    try {
        result = readFileSync(path, 'utf8');
    } catch {
        result = null;
    }
    fileContents.set(path, result);
    return result;
}

/** Test seam: forget everything probed so far. */
export function resetFsCache(): void {
    dirListings.clear();
    kinds.clear();
    fileContents.clear();
}
