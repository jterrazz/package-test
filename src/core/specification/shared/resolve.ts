import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

import type { CliEnv } from '../../ports/cli.port.js';

/** What makes a directory a project root — a manifest, or a test stack. */
const ROOT_MARKERS = ['package.json', 'docker/compose.test.yaml'];

/**
 * The NEAREST ancestor of `startDir` (itself included) carrying a root marker,
 * `undefined` when none does.
 *
 * Both markers are probed at each ancestor, in ONE walk. Two walks — the
 * compose file all the way up, then `package.json` all the way up — made the
 * further directory win: in a workspace, a `docker/compose.test.yaml` at the
 * repository root outranked the `package.json` of the very package being
 * tested, and every path the runner resolved was measured from the wrong unit.
 * The unit is the nearest thing that declares itself a project.
 *
 * The existence probe is injected so the lint layer can pass its cached one
 * (A9's `a9w-redundant-root` derives the same root, and must derive it the
 * same way).
 */
export function findRoot(startDir: string, exists: (path: string) => boolean): string | undefined {
    let dir = startDir;
    for (;;) {
        if (ROOT_MARKERS.some((marker) => exists(resolve(dir, marker)))) {
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
 * walk up to the first directory that carries `package.json` or
 * `docker/compose.test.yaml`; if none does, the starting directory itself.
 */
export function discoverRoot(startDir: string): string {
    return findRoot(startDir, existsSync) ?? startDir;
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
 * @internal Shared by the result scope, the literate runner and `$WORKDIR`.
 */
export function safeRealpath(path: string): string {
    try {
        return realpathSync(path);
    } catch {
        return path;
    }
}

/**
 * Expand the `$WORKDIR` token in every string value of a child environment —
 * the one place the token is spelled out, for both doors (`.env()` on the
 * chain, `env:` in a `<case>.spec.yaml`).
 *
 * It expands to the RESOLVED directory, never the raw temp path: a value the
 * child receives comes back in its output, and it must come back spelled the
 * way `{{workdir}}` holds it (realpath form, CONVENTIONS D4). Expanding the raw
 * path made `HOME=$WORKDIR` on macOS echo `/var/folders/…` against a
 * `{{workdir}}` holding `/private/var/folders/…` — a golden no run could match.
 */
export function expandWorkdir(env: CliEnv, workDir: string): CliEnv {
    const workdir = safeRealpath(workDir);
    const expanded: CliEnv = {};
    for (const [key, value] of Object.entries(env)) {
        expanded[key] = typeof value === 'string' ? value.replace(/\$WORKDIR/g, workdir) : value;
    }
    return expanded;
}
