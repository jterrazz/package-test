import { spawnSync } from 'node:child_process';
import { lstatSync, readdirSync, renameSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';

/**
 * The tree every gate judges and the runtime reads: what git does NOT ignore
 * — tracked files, and untracked ones no `.gitignore` names. A `.gitignore`d
 * path counts nowhere; a file nobody has added yet counts everywhere, so a new
 * module and its new test are judged the moment they are written, in the
 * editor as in CI.
 *
 * A directory inside a git work tree is answered from ONE `git ls-files
 * --cached --others --exclude-standard` of that tree, run from its top level:
 * its listed paths still on disk (a deleted file the index still holds is
 * gone), typed as the disk types them. A
 * directory git places in no work tree — `git rev-parse --show-cdup` fails
 * there, and a hand-made `.git` folder fails it too — is read from the disk,
 * which is where every E2E fixture the runner copies and every rule test's
 * scratch tree live.
 *
 * The listing judges the project's OWN files. A path inside a `node_modules/`
 * is a dependency's, whatever `.gitignore` says of it, and is read from the
 * disk too.
 *
 * A listing answers only while it is newer than what it was read from. It is
 * read again when git's index, or the directory a question reads the children
 * of, changed after it was taken — so an editor host that keeps this module
 * loaded across lint runs sees a file written between two of them — and it is
 * dropped by {@link forgetTree}.
 */

/** A listed child: the part of `Dirent` the walks read. */
export type TreeEntry = {
    isDirectory: () => boolean;
    isFile: () => boolean;
    isSymbolicLink: () => boolean;
    name: string;
};

/**
 * One work tree: its top level, per listed directory the names it holds, the
 * index file git keeps for it, and when the listing began (epoch ms).
 */
type WorkTree = {
    children: Map<string, Set<string>>;
    index: string;
    listedAt: number;
    top: string;
};

const trees: WorkTree[] = [];
/** Directories known to lie in no work tree — their descendants neither. */
const outside = new Set<string>();

function under(dir: string, root: string): boolean {
    return dir === root || dir.startsWith(root.endsWith(sep) ? root : `${root}${sep}`);
}

/** The paths git does not ignore in the tree at `top`, `/`-separated, or null when git will not say. */
function listNotIgnored(top: string): null | string[] {
    const listed = spawnSync(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
        {
            cwd: top,
            encoding: 'utf8',
            maxBuffer: 256 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'ignore'],
        },
    );
    if (listed.error !== undefined || listed.status !== 0) {
        return null;
    }
    return listed.stdout.split('\0').filter((path) => path !== '');
}

function indexOf(top: string, paths: string[], index: string, listedAt: number): WorkTree {
    const children = new Map<string, Set<string>>();
    for (const path of paths) {
        // An untracked nested repository is listed as `sub/`: the trailing
        // Separator names no child.
        const segments = path.split('/').filter((segment) => segment !== '');
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
    return { children, index, listedAt, top };
}

/** When `path` last changed (epoch ms), 0 when it is not there. */
function changedAt(path: string): number {
    return statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? 0;
}

/** Is the listing older than the index, or than the directory `dir` whose children are read? */
function stale(tree: WorkTree, dir: string): boolean {
    return changedAt(tree.index) > tree.listedAt || changedAt(dir) > tree.listedAt;
}

/** A fresh listing of the work tree at `top`, or null when git will not say. */
function listTree(top: string, index: string): null | WorkTree {
    const listedAt = Date.now();
    const paths = listNotIgnored(top);
    return paths === null ? null : indexOf(top, paths, index, listedAt);
}

/** Is `path` inside an installed dependency? */
function inDependency(path: string): boolean {
    return path.split(sep).includes('node_modules');
}

/**
 * The work tree `dir` lies in, or null when git places it in none or it is a
 * dependency's — listed afresh when the listing is older than `read`, the
 * directory whose children the caller is about to read.
 */
function workTreeOf(dir: string, read: string): null | WorkTree {
    if (inDependency(dir)) {
        return null;
    }
    const at = trees.findIndex(({ top }) => under(dir, top));
    const known = trees[at];
    if (known !== undefined) {
        if (!stale(known, read)) {
            return known;
        }
        const relisted = listTree(known.top, known.index);
        if (relisted === null) {
            trees.splice(at, 1);
            return null;
        }
        trees[at] = relisted;
        return relisted;
    }
    if ([...outside].some((root) => under(dir, root))) {
        return null;
    }
    const located = spawnSync('git', ['rev-parse', '--show-cdup', '--git-path', 'index'], {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    // `--show-cdup` prints an empty line at the top level: the two answers are
    // Read by position, never trimmed together.
    const [cdup = '', index = ''] = (located.stdout ?? '').split('\n');
    const top = resolve(dir, cdup);
    const tree =
        located.error === undefined && located.status === 0
            ? listTree(top, resolve(dir, index))
            : null;
    if (tree === null) {
        outside.add(dir);
        return null;
    }
    trees.push(tree);
    return tree;
}

/** A listed child as the disk types it, or null when it is gone from the disk. */
function entryOf(dir: string, name: string): null | TreeEntry {
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
 * The children of `dir` a walk may read — the ones git does not ignore in a
 * work tree, every one elsewhere. It throws where `readdirSync` throws: a
 * directory that is not there is not an empty one.
 */
export function treeEntries(dir: string): TreeEntry[] {
    const absolute = resolve(dir);
    const onDisk = readdirSync(absolute, { withFileTypes: true });
    const tree = workTreeOf(absolute, absolute);
    if (tree === null) {
        return onDisk;
    }
    const names = tree.children.get(absolute) ?? new Set<string>();
    return [...names]
        .map((name) => entryOf(absolute, name))
        .filter((entry): entry is TreeEntry => entry !== null);
}

/** The names `treeEntries` lists. */
export function treeNames(dir: string): string[] {
    return treeEntries(dir).map(({ name }) => name);
}

/**
 * What one path names, read through the same listing: `directory` or `file` as
 * the disk types it (a link followed), or undefined when it is not on disk or,
 * inside a work tree, when git ignores it and everything below it.
 */
export function treeKind(path: string): 'directory' | 'file' | undefined {
    const absolute = resolve(path);
    let directory: boolean;
    try {
        directory = statSync(absolute).isDirectory();
    } catch {
        return undefined;
    }
    const kind = directory ? 'directory' : 'file';
    const tree = workTreeOf(directory ? absolute : dirname(absolute), dirname(absolute));
    if (tree === null) {
        return kind;
    }
    const listed =
        absolute === tree.top ||
        (tree.children.get(dirname(absolute))?.has(basename(absolute)) ?? false);
    return listed ? kind : undefined;
}

/** Forget every listing: a move changed what the tree holds. */
export function forgetTree(): void {
    trees.length = 0;
    outside.clear();
}

/**
 * Move a file or a directory, keeping git's record of it where there is one.
 *
 * `git mv` is tried first and its failure is not an error: a path outside a
 * working tree, or one git does not track yet, moves exactly as well with
 * `renameSync`. A plain rename of a tracked path would lose its history and
 * leave the old path deleted in the index. Either move changes the tree, so
 * the listing is read again.
 */
export function moveKeepingHistory(from: string, to: string): void {
    const moved = spawnSync('git', ['mv', from, to], {
        cwd: dirname(from),
        stdio: 'ignore',
    });
    if (moved.status !== 0) {
        renameSync(from, to);
    }
    forgetTree();
}
