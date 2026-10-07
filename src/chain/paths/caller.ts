import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { safeRealpath } from '../../../lint/kit/project/resolve.js';

// invariant: module tests are callers, not internals (rule `test-in-its-tests-folder`).
const TEST_FILE = /\.test\.[cm]?[jt]s$/u;

export type StackFrame = { column: number; file: string; line: number };

// invariant: a frame's location, in either shape V8 prints it in: `at fn (<location>)` or `at <location>`.
const FRAME_LOCATION = /^at (?:.*? \((?<wrapped>[^()]+)\)|(?:async )?(?<bare>[^()\s]+))$/u;

const POSITION = /^(?<file>.+):(?<line>\d+):(?<column>\d+)$/u;

export function stackFrames(stack: string): StackFrame[] {
    const frames: StackFrame[] = [];
    for (const text of stack.split('\n')) {
        const groups = FRAME_LOCATION.exec(text.trim())?.groups;
        // Stryker disable next-line StringLiteral: a line no frame pattern reads holds no position, whatever text stands in for it
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
    // Stryker disable next-line StringLiteral: the message heads the stack on a line no frame pattern reads
    const { stack } = new Error('@jterrazz/test: reading the call site');
    return stackFrames(stack ?? '').filter(({ file }) => file !== import.meta.filename);
}

const SOURCE_LOCATION = join('chain', 'paths');

// invariant: real path, so a `file:`-linked install is still recognised as the framework.
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

/** By identity, never by substring: a consumer's own `src/chain/` is not this package's. */
export function isFrameworkFrame(
    filePath: string,
    frameworkTrees: readonly string[] = FRAMEWORK_TREES,
): boolean {
    if (TEST_FILE.test(filePath)) {
        return false;
    }
    // hazard: both sides through realpath: an install reached by symlink must compare equal to itself.
    const real = safeRealpath(filePath);
    return frameworkTrees.some((tree) => isStrictlyInside(safeRealpath(tree), real));
}

/** Must be called before the first `await`: async resumption drops the caller's frames. */
export function getCallerDir(): string {
    const caller = callerFrames().find(
        ({ file }) => !file.includes('node_modules') && !isFrameworkFrame(file),
    );
    /* invariant: every frame internal: the chain was started from node_modules (a rule pack declaring tests), so the working directory stands in. */
    // Stryker disable next-line ConditionalExpression: a module test is always a caller frame of its own, so only a chain started from node_modules takes the fallback
    return caller === undefined ? process.cwd() : dirname(caller.file);
}
