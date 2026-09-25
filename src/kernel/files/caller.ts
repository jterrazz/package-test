import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { safeRealpath } from './resolve.js';

/** Sibling module tests are callers, not internals (CONVENTIONS I2). */
const TEST_FILE = /\.test\.[cm]?[jt]s$/u;

/** One frame of a V8 stack: the file it ran in, and where in it. */
export type StackFrame = { column: number; file: string; line: number };

/** A frame's location, in either shape V8 prints it in: `at fn (<location>)` or `at <location>`. */
const FRAME_LOCATION = /^at (?:.*? \((?<wrapped>[^()]+)\)|(?:async )?(?<bare>[^()\s]+))$/u;

/** A location's file, line and column. */
const POSITION = /^(?<file>.+):(?<line>\d+):(?<column>\d+)$/u;

/**
 * The frames of a stack, innermost first: a `file:` URL reads as its path, and
 * node's own internals (`node:`) are left out.
 */
export function stackFrames(stack: string): StackFrame[] {
    const frames: StackFrame[] = [];
    for (const text of stack.split('\n')) {
        const groups = FRAME_LOCATION.exec(text.trim())?.groups;
        const position = POSITION.exec(groups?.wrapped ?? groups?.bare ?? '')?.groups;
        if (position?.file === undefined || position.file.startsWith('node:')) {
            continue;
        }
        const file = position.file.startsWith('file:')
            ? fileURLToPath(position.file)
            : position.file;
        frames.push({ column: Number(position.column), file, line: Number(position.line) });
    }
    return frames;
}

/**
 * The frames of the stack where this is called, innermost first, less this
 * module's own. The error is never thrown: asking V8 who called is what a
 * stack is for, and its message says so where one prints.
 */
export function callerFrames(): StackFrame[] {
    const { stack } = new Error('@jterrazz/test: reading the call site');
    return stackFrames(stack ?? '').filter(({ file }) => file !== import.meta.filename);
}

/** Where this very module sits inside the framework's SOURCE tree. */
const SOURCE_LOCATION = join('kernel', 'files');

/**
 * Directory of the running framework module itself. From the built package
 * this is `<package root>/dist`, whatever the resolution path — including a
 * `file:` link, where the real path carries neither `node_modules` nor
 * `/src/…` and would otherwise be mistaken for a caller frame.
 */
const FRAMEWORK_DIR = safeRealpath(import.meta.dirname);

/**
 * The directories holding the framework's OWN modules, from the directory this
 * module runs in: `<repo>/src` when the framework runs from source — this
 * module's known location inside that tree is what tells the two apart — and
 * for a build, `<package>/dist` (everything is bundled there) with the
 * `<package>/src` its source maps point back to: once a runner applies those
 * maps, a frame of the bundle reads as a frame of its source, and it is still
 * the framework's, never its caller's. An install ships no maps and no `src/`.
 *
 * @internal
 */
export function frameworkTreesOf(frameworkDir: string): string[] {
    return frameworkDir.endsWith(`${sep}${SOURCE_LOCATION}`)
        ? [resolve(frameworkDir, '../..')]
        : [frameworkDir, resolve(frameworkDir, '..', 'src')];
}

const FRAMEWORK_TREES = frameworkTreesOf(FRAMEWORK_DIR);

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
 * and never by substring: a consumer's own `src/kernel/` is not this package's,
 * and reading it as one would skip the consumer's files as internals and
 * anchor fixture resolution on the wrong directory.
 *
 * @internal
 */
export function isFrameworkFrame(
    filePath: string,
    frameworkTrees: readonly string[] = FRAMEWORK_TREES,
): boolean {
    if (TEST_FILE.test(filePath)) {
        return false;
    }
    // Both sides go through realpath: an install reached by symlink (a `file:`
    // link, a pnpm store, a worktree) must still compare equal to itself.
    const real = safeRealpath(filePath);
    return frameworkTrees.some((tree) => isInside(safeRealpath(tree), real));
}

/**
 * Detect the directory of the first stack frame that lives outside this
 * package. Used to anchor fixture resolution (`seeds/`, `requests/`,
 * `expected/`, …) on the calling test / specification file.
 *
 * @internal
 */
export function getCallerDir(): string {
    const caller = callerFrames().find(
        ({ file }) => !file.includes('node_modules') && !isFrameworkFrame(file),
    );
    /*
     * Every frame framework- or package-internal: the chain was started by
     * code living in node_modules (a published rule pack declaring tests
     * itself). There is no consumer test file to anchor on, so the working
     * directory stands in; such packs assert on results directly and never
     * resolve `expected/` fixtures.
     */
    return caller === undefined ? process.cwd() : dirname(caller.file);
}
