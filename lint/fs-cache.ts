import { readFileSync, statSync } from 'node:fs';

import { forgetTree, treeKind, treeNames } from '../src/seams/git/tree.js';

/**
 * Filesystem probes for the plugin's fs-anchored rules — every rule that reads
 * the tree beside the file oxlint visits — and the anchors they stand on.
 *
 * A rule's evidence is read through the tree the checker walks
 * (`src/seams/git/tree.ts`): inside a git work tree a file git ignores
 * neither satisfies nor violates a rule, an untracked one it does not ignore
 * counts like a tracked one, and elsewhere the disk answers. The one
 * exception is {@link isOnDisk}, for what git never lists by construction —
 * a repository's own `.git`.
 *
 * No answer is kept here past the moment it could change: the editor's host
 * keeps this module loaded across lint runs, and oxlint marks no run boundary
 * a plugin can see. The listing keeps itself fresh (the seam reads it again
 * when the index or the directory asked about moved), and a file's text is
 * kept only while its modification time is the one it was read at.
 */

/** The children of `dir` git does not ignore, or null when it is not a directory. */
export function listDirectory(dir: string): null | string[] {
    try {
        return treeNames(dir);
    } catch {
        return null;
    }
}

export function isDirectory(path: string): boolean {
    return treeKind(path) === 'directory';
}

export function isFile(path: string): boolean {
    return treeKind(path) === 'file';
}

/** Is anything at `path` on disk, listed or not — for `.git`, which git never lists. */
export function isOnDisk(path: string): boolean {
    try {
        statSync(path);
        return true;
    } catch {
        return false;
    }
}

/** A file's text, and the modification time it was read at. */
type Read = { changedAt: number; text: null | string };

const fileContents = new Map<string, Read>();

/** Read a listed file as UTF-8, cached while it is unchanged. Returns null when ignored or unreadable (missing/binary). */
export function readFileCached(path: string): null | string {
    if (!isFile(path)) {
        return null;
    }
    const changedAt = statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? 0;
    const cached = fileContents.get(path);
    if (cached !== undefined && cached.changedAt === changedAt) {
        return cached.text;
    }
    let text: null | string;
    try {
        text = readFileSync(path, 'utf8');
    } catch {
        text = null;
    }
    fileContents.set(path, { changedAt, text });
    return text;
}

/** Test seam: forget everything probed so far. */
export function resetFsCache(): void {
    fileContents.clear();
    forgetTree();
}
