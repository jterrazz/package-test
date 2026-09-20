import { realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Sibling module tests are callers, not internals (CONVENTIONS I2). */
const TEST_FILE = /\.test\.[cm]?[jt]s$/u;

/** Where this very module sits inside the framework's SOURCE tree. */
const SOURCE_LOCATION = join('core', 'chain');

/** The real path of `path`, or `path` itself when it cannot be resolved. */
function realPath(path: string): string {
    try {
        return realpathSync(path);
    } catch {
        return path;
    }
}

/**
 * Directory of the running framework module itself. From the built package
 * this is `<package root>/dist`, whatever the resolution path — including a
 * `file:` link, where the real path carries neither `node_modules` nor
 * `/src/…` and would otherwise be mistaken for a caller frame.
 */
const FRAMEWORK_DIR = realPath(import.meta.dirname);

/**
 * The directory holding the framework's OWN modules: `<package>/dist` for a
 * built install (everything is bundled there), `<repo>/src` when the framework
 * runs from source — this module's known location inside that tree is what
 * tells the two apart.
 */
const FRAMEWORK_TREE = FRAMEWORK_DIR.endsWith(`${sep}${SOURCE_LOCATION}`)
    ? resolve(FRAMEWORK_DIR, '../..')
    : FRAMEWORK_DIR;

/** Is `path` inside `directory` (strictly — a directory is not inside itself)? */
function isInside(directory: string, path: string): boolean {
    const rest = relative(directory, path);
    return rest !== '' && !rest.startsWith('..') && !isAbsolute(rest);
}

/**
 * Is this stack frame a module of the framework itself, rather than of the code
 * calling it?
 *
 * Answered by IDENTITY — the frame is inside the framework's own directory —
 * and never by substring: a consumer's own `src/core/` is not this package's,
 * and reading it as one would skip the consumer's files as internals and
 * anchor fixture resolution on the wrong directory.
 *
 * @internal
 */
export function isFrameworkFrame(filePath: string, frameworkTree = FRAMEWORK_TREE): boolean {
    if (TEST_FILE.test(filePath)) {
        return false;
    }
    // Both sides go through realpath: an install reached by symlink (a `file:`
    // Link, a pnpm store, a worktree) must still compare equal to itself.
    return isInside(realPath(frameworkTree), realPath(filePath));
}

/**
 * Detect the directory of the first stack frame that lives outside this
 * package. Used to anchor fixture resolution (`_seeds/`, `_requests/`,
 * `_expected/`, …) on the calling test / specification file.
 *
 * @internal
 */
export function getCallerDir(): string {
    const { stack } = new Error('caller detection');
    if (!stack) {
        throw new Error('Cannot detect caller directory: no stack trace');
    }

    const lines = stack.split('\n');
    for (const line of lines) {
        const match = /at\s+(?:.*?\()?(?:file:\/\/)?(?<filePath>[^:)]+):\d+:\d+/u.exec(line);
        if (!match?.groups?.filePath) {
            continue;
        }

        const { filePath } = match.groups;

        if (filePath.includes('node_modules')) {
            continue;
        }
        if (isFrameworkFrame(filePath)) {
            continue;
        }

        return resolve(filePath, '..');
    }

    // Every frame is framework- or package-internal: the chain was started
    // By code living in node_modules (e.g. a published rule pack declaring
    // Tests itself). There is no consumer test file to anchor on — fall back
    // To the working directory; such packs assert on results directly and
    // Never resolve `_expected/` fixtures.
    return process.cwd();
}
