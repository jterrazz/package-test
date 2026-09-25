import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

import { treeKind } from './git-tree.js';
import { requireRelativePath } from './spec-path.js';

/** What makes a directory a project root: the thing that declares itself one. */
const ROOT_MARKER = 'package.json';

/**
 * The NEAREST ancestor of `startDir` (itself included) carrying the root
 * marker, `undefined` when none does.
 *
 * One marker, and it is the nearest thing that declares itself a project: a
 * second marker higher in the tree would outrank the `package.json` of the very
 * package being tested, and every path the runner resolves would be measured
 * from the wrong unit.
 *
 * The existence probe is injected so the lint layer can pass its cached one
 * (A9's `a9w-redundant-root` derives the same root, and must derive it the
 * same way): both read the tree git does not ignore, so a `.gitignore`d
 * `package.json` marks no root for either.
 */
export function findRoot(startDir: string, exists: (path: string) => boolean): string | undefined {
    let dir = startDir;
    for (;;) {
        if (exists(resolve(dir, ROOT_MARKER))) {
            return dir;
        }
        const parent = dirname(dir);
        if (parent === dir) {
            return undefined;
        }
        dir = parent;
    }
}

/**
 * Auto-discover the project root from a starting directory (CONVENTIONS A9):
 * walk up to the first directory that carries a `package.json` git does not
 * ignore (outside a work tree, any on disk); if none does, the starting
 * directory itself.
 */
export function discoverRoot(startDir: string): string {
    return findRoot(startDir, (path) => treeKind(path) === 'file') ?? startDir;
}

/**
 * Resolve the project root for a specification. An explicit `root` option is
 * an override (resolved from the caller's directory when relative); when
 * absent, the root is auto-discovered by walking up from the calling
 * specification file.
 */
export function resolveRoot(root: string | undefined, callerDir: string): string {
    if (!root) {
        return discoverRoot(callerDir);
    }
    if (isAbsolute(root)) {
        return root;
    }
    return resolve(callerDir, root);
}

/**
 * Resolve a command — checks node_modules/.bin, then treats as absolute/PATH.
 */
export function resolveCommand(command: string, root: string): string {
    if (isAbsolute(command)) {
        return command;
    }

    const binPath = resolve(root, 'node_modules/.bin', command);
    if (existsSync(binPath)) {
        return binPath;
    }

    const cwdBinPath = resolve(process.cwd(), 'node_modules/.bin', command);
    if (existsSync(cwdBinPath)) {
        return cwdBinPath;
    }

    return command;
}

/**
 * The realpath form of a working directory — what a child process prints as
 * `$PWD` (macOS resolves the tmpdir symlink), and therefore what `{{workdir}}`
 * compares against. Falls back to the path itself when it cannot be resolved.
 *
 * @internal Shared by the result scope, the literate runner and the actions that expand `$WORKDIR`.
 */
export function safeRealpath(path: string): string {
    try {
        return realpathSync(path);
    } catch {
        return path;
    }
}

/**
 * The absolute path a spec names a file by, read from the spec file's own
 * directory. The path is refused unless it is relative (`./…`, `../…`).
 */
export function resolveSpecPath(verb: string, path: string, specDir: string): string {
    requireRelativePath(verb, path);
    return resolve(specDir, path);
}
