import { spawnSync } from 'node:child_process';
import { lstatSync, readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

/**
 * The directory listing every walk of the conventions checker reads: what git
 * TRACKS, like every tree gate of the toolchain, so a file nobody added counts
 * nowhere — not on the workstation that holds it, not on the checkout that
 * does not.
 *
 * A directory inside a git work tree is answered from ONE `git ls-files
 * --cached` of that tree, run from its top level and kept for the run: its
 * tracked paths that are still on disk, typed as the disk types them. A
 * directory git does not place in any work tree — `git rev-parse --show-cdup`
 * fails there, and a hand-made `.git` folder fails it too — is read from the
 * disk, which is where every E2E fixture the runner copies and every rule
 * test's scratch tree live.
 */

/** A listed child: the part of `Dirent` the walks read. */
export type TrackedEntry = {
    isDirectory: () => boolean;
    isFile: () => boolean;
    isSymbolicLink: () => boolean;
    name: string;
};

/** One work tree: its top level and, per tracked directory, the names it holds. */
type WorkTree = { children: Map<string, Set<string>>; top: string };

const trees: WorkTree[] = [];
/** Directories known to lie in no work tree — their descendants neither. */
const outside = new Set<string>();

function under(dir: string, root: string): boolean {
    return dir === root || dir.startsWith(root.endsWith(sep) ? root : `${root}${sep}`);
}

/** The tracked paths of the tree at `top`, `/`-separated, or null when git will not say. */
function listTracked(top: string): null | string[] {
    const listed = spawnSync('git', ['ls-files', '--cached', '-z'], {
        cwd: top,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (listed.error !== undefined || listed.status !== 0) {
        return null;
    }
    return listed.stdout.split('\0').filter((path) => path !== '');
}

function indexOf(top: string, paths: string[]): WorkTree {
    const children = new Map<string, Set<string>>();
    for (const path of paths) {
        const segments = path.split('/');
        let parent = top;
        for (const segment of segments) {
            let names = children.get(parent);
            if (names === undefined) {
                names = new Set();
                children.set(parent, names);
            }
            names.add(segment);
            parent = join(parent, segment);
        }
    }
    return { children, top };
}

/** The work tree `dir` lies in, or null when git places it in none. */
function workTreeOf(dir: string): null | WorkTree {
    const known = trees.find(({ top }) => under(dir, top));
    if (known !== undefined) {
        return known;
    }
    if ([...outside].some((root) => under(dir, root))) {
        return null;
    }
    const cdup = spawnSync('git', ['rev-parse', '--show-cdup'], {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    const paths =
        cdup.error === undefined && cdup.status === 0
            ? listTracked(resolve(dir, cdup.stdout.trim()))
            : null;
    if (paths === null) {
        outside.add(dir);
        return null;
    }
    const tree = indexOf(resolve(dir, cdup.stdout.trim()), paths);
    trees.push(tree);
    return tree;
}

/** A tracked child as the disk types it, or null when it is gone from the disk. */
function entryOf(dir: string, name: string): null | TrackedEntry {
    let stats;
    try {
        stats = lstatSync(join(dir, name));
    } catch {
        return null;
    }
    return {
        isDirectory: () => stats.isDirectory(),
        isFile: () => stats.isFile(),
        isSymbolicLink: () => stats.isSymbolicLink(),
        name,
    };
}

/**
 * The children of `dir` a walk may read — tracked ones in a work tree, every
 * one elsewhere. It throws where `readdirSync` throws: a directory that is
 * not there is not an empty one.
 */
export function trackedEntries(dir: string): TrackedEntry[] {
    const absolute = resolve(dir);
    const onDisk = readdirSync(absolute, { withFileTypes: true });
    const tree = workTreeOf(absolute);
    if (tree === null) {
        return onDisk;
    }
    const names = tree.children.get(absolute) ?? new Set<string>();
    return [...names]
        .map((name) => entryOf(absolute, name))
        .filter((entry): entry is TrackedEntry => entry !== null);
}

/** The names `trackedEntries` lists. */
export function trackedNames(dir: string): string[] {
    return trackedEntries(dir).map(({ name }) => name);
}

/** Forget every listing: a `git mv` changed what the index holds. */
export function forgetTracked(): void {
    trees.length = 0;
    outside.clear();
}
