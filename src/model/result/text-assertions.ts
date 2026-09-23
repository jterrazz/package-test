import { formatStdoutDiff } from '../chain/reporter.js';
import { isDiskTarget } from '../chain/spec-path.js';
import { dedent } from '../matching/dedent.js';
import { CaptureScope } from '../matching/match.js';
import { textEquals } from '../matching/structural.js';
import type { TableMatchOptions } from './match-options.js';
import { TextAccessor } from './text.js';

/**
 * What a stream assertion DECIDES, with no idea of where the fixture came from.
 *
 * A golden is read from disk under node and through a server command from
 * inside a page — two transports, one comparison. Keeping the judgement here,
 * pure, is what makes `expect(result.stdout).toMatch(file('./expected/help.txt'))`
 * and `expect(result.tree).toMatch(file('./expected/table.aria.yaml'))` the same
 * assertion with the same diff, instead of two implementations that drift a
 * token at a time.
 */

/** A matcher's verdict: the boolean vitest reads, and the message it prints. */
export type TextComparison = {
    message: () => string;
    pass: boolean;
};

/** The golden's path carries its extension — the name IS the file. */
export function requireExtension(name: string, subject: string): void {
    if (!/\.[A-Za-z0-9]+$/u.test(name)) {
        throw new Error(
            `toMatch(file("${name}")): the extension is part of the path and is required for ${subject} subjects (e.g. file('./expected/help.txt')).`,
        );
    }
}

/**
 * Compare a captured stream against the CONTENT of its golden. Text snapshots
 * share the unified `{{token}}` grammar (CONVENTIONS D4), and the diff judges
 * each line through the SAME grammar the comparison used — so a token line
 * that matched is shown as equal instead of competing with the real mismatch
 * for the reader's attention.
 */
export function compareStreamText(
    accessor: TextAccessor,
    name: string,
    expected: string,
): TextComparison {
    const actual = accessor.text;
    if (textEquals(expected, actual, accessor.captures)) {
        return {
            message: () => `expected ${accessor.streamName} not to match ${name}`,
            pass: true,
        };
    }
    return {
        message: () =>
            formatStdoutDiff(name, expected, actual, {
                equals: (expectedLine, actualLine) =>
                    textEquals(
                        expectedLine,
                        actualLine,
                        new CaptureScope(accessor.captures.workdir),
                    ),
            }),
        pass: false,
    };
}

/**
 * `toBeEmpty` on a stream is refused, in both builds: an empty stream is an
 * empty text, and vitest's own `toBe('')` says so on the text a golden reads.
 */
export function emptyStreamRefusal(accessor: TextAccessor): TypeError {
    return new TypeError(
        `toBeEmpty: "${accessor.streamName}" is a stream, and an empty stream is an empty text — write expect(<stream>.text).toBe('')`,
    );
}

/** How a value handed to `toMatch` is read: whole, refused, or vitest's own. */
export type ValueRoute = 'whole' | TypeError | undefined;

/** How the comparison names an expectation written in the test rather than a file. */
export const IN_PLACE = 'the value in place';

/**
 * A stream is compared WHOLE to a text written in place, in both builds: a
 * stream is no string, so vitest's substring meaning never applied to it, and
 * the text it is compared as is its `.text` — the comparable text a golden
 * reads. A RegExp matches a part, which is vitest's, on `.text`. Any other
 * subject is not this route's to answer.
 */
export function streamValueRoute(subject: unknown, value: unknown): ValueRoute {
    if (!(subject instanceof TextAccessor)) {
        return undefined;
    }
    return typeof value === 'string'
        ? 'whole'
        : new TypeError(
              `toMatch: "${subject.streamName}" is a stream, compared whole to the text written in place — a RegExp matches a part of it, which is vitest's: expect(<stream>.text).toMatch(…).`,
          );
}

/**
 * Compare a stream against a text written in place: the same comparison, and
 * the same diff, a golden file gets.
 */
export function compareStreamInPlace(accessor: TextAccessor, expected: string): TextComparison {
    return compareStreamText(accessor, IN_PLACE, dedent(expected));
}

/** The name the golden comparison is registered under — no member access can spell it. */
export const GOLDEN_MATCHER = '@jterrazz/test:golden';

/** The name the whole-result comparison against a value is registered under. */
export const WHOLE_MATCHER = '@jterrazz/test:whole';

/**
 * What the whole-result comparison is handed besides its value: the options
 * the test passed, and the stack of the call — where update mode writes.
 */
export type WholeCall = { options: TableMatchOptions | undefined; stack: string };

/** The options a caller handed, read without trusting their shape: `frozen`, and a table's `ordered`. */
function optionsOf(value: unknown): TableMatchOptions | undefined {
    return value !== null && typeof value === 'object'
        ? {
              frozen: Reflect.get(value, 'frozen') === true,
              ordered: Reflect.get(value, 'ordered') === true,
          }
        : undefined;
}

/** The slice of vitest's `chai` the golden route needs. */
type Chai = {
    Assertion: { prototype: object };
    util: {
        flag: (assertion: object, key: 'object') => unknown;
        overwriteMethod: (
            target: object,
            name: string,
            method: (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown,
        ) => void;
    };
};

/** Where a location's file sits — its query string or hash dropped, its `file://` scheme too. */
function directoryOf(location: string): string {
    const normalized = location.replace(/^file:\/\//u, '').replace(/[?#].*$/u, '');
    return normalized.slice(0, normalized.lastIndexOf('/'));
}

/**
 * This module's own directory: `dist/` under an installed node build, a
 * page's deps-bundle folder under a browser — where a bundler co-locates
 * every dependency's code, this one and vitest's matcher plumbing alike.
 */
const OWN_DIRECTORY = directoryOf(import.meta.url);

/** A stack line that is a frame, never the error's own (possibly multi-line) message. */
const FRAME_LINE = /^\s*at\s/u;

/** A frame's file — a bare path, a `file://` one or a page's served URL. */
const FRAME_FILE =
    /at\s+(?:async\s+)?(?:.*?\s+)?\(?(?<file>(?:file:\/\/)?\/[^():]+|https?:\/\/.+?):\d+:\d+\)?\s*$/u;

/** The directory a stack frame's file sits in, or `undefined` past what the pattern reads. */
function frameDirectoryOf(line: string): string | undefined {
    const file = FRAME_FILE.exec(line.trim())?.groups?.file;
    return file === undefined ? undefined : directoryOf(file);
}

/**
 * Cut every frame of `stack` that sits in `directory` — this router's own,
 * and whatever a bundler co-located there — so a reader's first frame is
 * whichever call reached it: the test's own line, not this routing.
 *
 * A page bundles this module beside vitest's own matcher plumbing, in one
 * file with no source map either owns, so a failure raised there names an
 * unreadable line before the test's; under node the same frame is legible
 * and still not the test's. Either way the boundary is WHERE the code runs
 * from, never a name a bundler is free to rewrite, and every one of this
 * router's own frames is cut, not only a leading run of them: vitest's own
 * matcher plumbing sits ABOVE this router on the stack, between it and the
 * throw, so the frame this router left is never actually first.
 */
export function cutFramesUnder(stack: string, directory: string): string {
    return stack
        .split('\n')
        .filter((line) => !FRAME_LINE.test(line) || frameDirectoryOf(line) !== directory)
        .join('\n');
}

/** Does `value` look like a promise — thenable, never assumed to BE one? */
function isThenable(value: unknown): value is Promise<unknown> {
    return (
        value !== null &&
        typeof value === 'object' &&
        typeof (value as { then?: unknown }).then === 'function'
    );
}

/** Cut this router's frames from `error` and rethrow it — its stack alone changes, never its identity. */
function rethrowCut(error: unknown): never {
    if (error instanceof Error && error.stack !== undefined) {
        error.stack = cutFramesUnder(error.stack, OWN_DIRECTORY);
    }
    throw error;
}

/** Await `result`, cutting this router's own frames from a rejection. */
async function awaitedCut(result: Promise<unknown>): Promise<unknown> {
    try {
        return await result;
    } catch (error) {
        return rethrowCut(error);
    }
}

/** Run `route`, cutting this router's own frames from what it throws — now, or once its promise rejects. */
function routedThrough(route: () => unknown): unknown {
    let result: unknown;
    try {
        result = route();
    } catch (error) {
        return rethrowCut(error);
    }
    return isThenable(result) ? awaitedCut(result) : result;
}

/**
 * `toMatch` routes a `file()` or a `directory()` to the golden comparison, a
 * value handed to one of the framework's subjects to the whole-result
 * comparison, and EVERYTHING else to vitest's own matcher, untouched: on a
 * plain string a string or a RegExp is a value, and `toMatch` means exactly
 * what vitest says it means. It is the one vitest matcher wrapped.
 *
 * Both builds call this, each with the `chai` its `vitest` hands out, after
 * registering the golden under {@link GOLDEN_MATCHER} and the whole-result
 * comparison under {@link WHOLE_MATCHER}. `routeValue` tells, per subject and
 * value, whether the value is compared whole, refused (the subject takes no
 * such value — the types already refuse the call, and a caller past them
 * reads why), or vitest's. The whole-result comparison receives a
 * {@link WholeCall}: the options, and the call site's stack, where update mode
 * writes the value.
 */
export function matchThroughGolden(
    chai: Chai,
    routeValue: (subject: unknown, value: unknown) => ValueRoute,
): void {
    chai.util.overwriteMethod(
        chai.Assertion.prototype,
        'toMatch',
        (vitestToMatch) =>
            function toMatch(this: Record<string, unknown>, ...args: unknown[]): unknown {
                const golden = this[GOLDEN_MATCHER];
                if (isDiskTarget(args[0]) && typeof golden === 'function') {
                    return routedThrough(() => golden.apply(this, args) as unknown);
                }
                const route = routeValue(chai.util.flag(this, 'object'), args[0]);
                if (route instanceof TypeError) {
                    throw route;
                }
                const whole = this[WHOLE_MATCHER];
                if (route === 'whole' && typeof whole === 'function') {
                    const stack = new Error('toMatch call site').stack ?? '';
                    const call: WholeCall = { options: optionsOf(args[1]), stack };
                    return routedThrough(() => whole.call(this, args[0], call) as unknown);
                }
                return vitestToMatch.apply(this, args);
            },
    );
}
