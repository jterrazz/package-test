import { dedent } from '../../../lint/engine/project/dedent.js';
import { refusal } from '../../../lint/refusal.js';
import { isDiskTarget } from '../../kernel/files/spec-path.js';
import { TextAccessor } from '../text/text.js';
import { CaptureScope } from '../tokens/match.js';
import { textEquals } from '../tokens/structural.js';
import { formatStdoutDiff } from './diff.js';
import type { TableMatchOptions } from './match-options.js';

export type TextComparison = {
    message: () => string;
    pass: boolean;
};

/** The golden's path carries its extension — the name IS the file. */
export function requireExtension(name: string, subject: string): void {
    if (!/\.[A-Za-z0-9]+$/u.test(name)) {
        throw new Error(
            refusal({
                fix: `name the file with its extension: file('./_expected/help.txt')`,
                found: `toMatch(file("${name}")) on ${subject}, a golden path with no extension`,
                read: 'docs/14-assertions.md#one-verb-compares-a-whole-result-and-its-argument-says-where-the-expectation-lives',
                why: 'The extension is part of a golden’s path.',
            }),
        );
    }
}

/** The diff judges each line through the same token grammar, so a matched token line shows as equal. */
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

/** An empty stream is an empty text: `expect(stream.text).toBe('')`. */
export function emptyStreamRefusal(accessor: TextAccessor): TypeError {
    return new TypeError(
        refusal('one-verb-per-meaning', {
            fix: `compare its text: expect(<result>.${accessor.streamName}.text).toBe('')`,
            found: `toBeEmpty() on the stream "${accessor.streamName}" — an empty stream is an empty text`,
        }),
    );
}

export type ValueRoute = 'whole' | TypeError | undefined;

export const IN_PLACE = 'the value in place';

/** A stream is compared whole to a text in place; a RegExp matches a part, which is vitest's, on `.text`. */
export function streamValueRoute(subject: unknown, value: unknown): ValueRoute {
    if (!(subject instanceof TextAccessor)) {
        return undefined;
    }
    return typeof value === 'string'
        ? 'whole'
        : new TypeError(
              refusal('one-verb-per-meaning', {
                  fix: `write the whole text in place, toMatch('…'), or match a part with vitest on its text: expect(<result>.${subject.streamName}.text).toMatch(…)`,
                  found: `toMatch(a ${value instanceof RegExp ? 'RegExp' : typeof value}) on the stream "${subject.streamName}"`,
              }),
          );
}

export function compareStreamInPlace(accessor: TextAccessor, expected: string): TextComparison {
    return compareStreamText(accessor, IN_PLACE, dedent(expected));
}

/** The name the golden comparison is registered under — no member access can spell it. */
export const GOLDEN_MATCHER = '@jterrazz/test:golden';

export const WHOLE_MATCHER = '@jterrazz/test:whole';

export type WholeCall = { options: TableMatchOptions | undefined; stack: string };

function optionsOf(value: unknown): TableMatchOptions | undefined {
    return value !== null && typeof value === 'object'
        ? {
              frozen: Reflect.get(value, 'frozen') === true,
              ordered: Reflect.get(value, 'ordered') === true,
          }
        : undefined;
}

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

function directoryOf(location: string): string {
    const normalized = location.replace(/^file:\/\//u, '').replace(/[?#].*$/u, '');
    return normalized.slice(0, normalized.lastIndexOf('/'));
}

/** `dist/` under node, the deps bundle in a page, where a bundler co-locates vitest's matcher plumbing too. */
const OWN_DIRECTORY = directoryOf(import.meta.url);

const FRAME_LINE = /^\s*at\s/u;

const FRAME_FILE =
    /at\s+(?:async\s+)?(?:.*?\s+)?\(?(?<file>(?:file:\/\/)?\/[^():]+|https?:\/\/.+?):\d+:\d+\)?\s*$/u;

function frameDirectoryOf(line: string): string | undefined {
    const file = FRAME_FILE.exec(line.trim())?.groups?.file;
    return file === undefined ? undefined : directoryOf(file);
}

/** Every frame under `directory` is cut, not a leading run: vitest's plumbing sits above this router on the stack. */
export function cutFramesUnder(stack: string, directory: string): string {
    return stack
        .split('\n')
        .filter((line) => !FRAME_LINE.test(line) || frameDirectoryOf(line) !== directory)
        .join('\n');
}

function isThenable(value: unknown): value is Promise<unknown> {
    return (
        value !== null &&
        typeof value === 'object' &&
        typeof (value as { then?: unknown }).then === 'function'
    );
}

function rethrowCut(error: unknown): never {
    if (error instanceof Error && error.stack !== undefined) {
        error.stack = cutFramesUnder(error.stack, OWN_DIRECTORY);
    }
    throw error;
}

async function awaitedCut(result: Promise<unknown>): Promise<unknown> {
    try {
        return await result;
    } catch (error) {
        return rethrowCut(error);
    }
}

function routedThrough(route: () => unknown): unknown {
    let result: unknown;
    try {
        result = route();
    } catch (error) {
        return rethrowCut(error);
    }
    return isThenable(result) ? awaitedCut(result) : result;
}

/** `file()`/`directory()` go to the golden, a value handed to a framework subject to the whole comparison, everything else to vitest untouched. */
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
