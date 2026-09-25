import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { safeRealpath } from './resolve.js';

/** Sibling module tests are callers, not internals (CONVENTIONS I2). */
const TEST_FILE = /\.test\.[cm]?[jt]s$/u;

export type StackFrame = { column: number; file: string; line: number };

/** A frame's location, in either shape V8 prints it in: `at fn (<location>)` or `at <location>`. */
const FRAME_LOCATION = /^at (?:.*? \((?<wrapped>[^()]+)\)|(?:async )?(?<bare>[^()\s]+))$/u;

const POSITION = /^(?<file>.+):(?<line>\d+):(?<column>\d+)$/u;

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

export function callerFrames(): StackFrame[] {
    const { stack } = new Error('@jterrazz/test: reading the call site');
    return stackFrames(stack ?? '').filter(({ file }) => file !== import.meta.filename);
}

const SOURCE_LOCATION = join('kernel', 'files');

/** Real path, so a `file:`-linked install is still recognised as the framework. */
const FRAMEWORK_DIR = safeRealpath(import.meta.dirname);

/** From a build, `dist/` plus the `src/` its source maps point back to: a mapped frame is still the framework's. */
export function frameworkTreesOf(frameworkDir: string): string[] {
    return frameworkDir.endsWith(`${sep}${SOURCE_LOCATION}`)
        ? [resolve(frameworkDir, '../..')]
        : [frameworkDir, resolve(frameworkDir, '..', 'src')];
}

const FRAMEWORK_TREES = frameworkTreesOf(FRAMEWORK_DIR);

function isStrictlyInside(directory: string, path: string): boolean {
    const rest = relative(directory, path);
    return rest !== '' && !rest.startsWith('..') && !isAbsolute(rest);
}

/** By identity, never by substring: a consumer's own `src/kernel/` is not this package's. */
export function isFrameworkFrame(
    filePath: string,
    frameworkTrees: readonly string[] = FRAMEWORK_TREES,
): boolean {
    if (TEST_FILE.test(filePath)) {
        return false;
    }
    // Both sides through realpath: an install reached by symlink must compare equal to itself.
    const real = safeRealpath(filePath);
    return frameworkTrees.some((tree) => isStrictlyInside(safeRealpath(tree), real));
}

export function getCallerDir(): string {
    const caller = callerFrames().find(
        ({ file }) => !file.includes('node_modules') && !isFrameworkFrame(file),
    );
    /* Every frame internal: the chain was started from node_modules (a rule pack declaring tests), so the working directory stands in. */
    return caller === undefined ? process.cwd() : dirname(caller.file);
}
