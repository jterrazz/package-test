import { formatStdoutDiff } from '../chain/reporter.js';
import { isDiskTarget } from '../chain/spec-path.js';
import { CaptureScope } from '../matching/match.js';
import { textEquals } from '../matching/structural.js';
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

/**
 * A value `toMatch` on a stream is refused, in both builds: a stream is no
 * string, and the value it is compared as is its `.text` — the comparable text
 * a golden reads. Any other subject is not this refusal's to answer.
 */
export function streamValueRefusal(subject: unknown): TypeError | undefined {
    return subject instanceof TextAccessor
        ? new TypeError(
              `toMatch: "${subject.streamName}" is a stream, and a stream compared as a value is its text — write expect(<stream>.text).toMatch(…), or toMatch(file(…)) for its golden.`,
          )
        : undefined;
}

/** The name the golden comparison is registered under — no member access can spell it. */
export const GOLDEN_MATCHER = '@jterrazz/test:golden';

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

/**
 * `toMatch` routes a `file()` or a `directory()` to the golden comparison and
 * EVERYTHING else to vitest's own matcher, untouched: a string or a RegExp is a
 * value, and on a value `toMatch` means exactly what vitest says it means — a
 * stream is compared as `result.stdout.text`. It is the one vitest matcher
 * wrapped: `toContain` and every other value matcher are vitest's, on `.text`.
 *
 * Both builds call this, each with the `chai` its `vitest` hands out, after
 * registering the golden under {@link GOLDEN_MATCHER}. `refuseValue` names,
 * for a subject that is no string and takes no value, what it takes instead:
 * the types already refuse the call, and a caller past them (JavaScript, a
 * cast) reads that refusal rather than vitest's "expects to receive a string".
 */
export function matchThroughGolden(
    chai: Chai,
    refuseValue?: (subject: unknown) => TypeError | undefined,
): void {
    chai.util.overwriteMethod(
        chai.Assertion.prototype,
        'toMatch',
        (vitestToMatch) =>
            function toMatch(this: Record<string, unknown>, ...args: unknown[]): unknown {
                const golden = this[GOLDEN_MATCHER];
                if (isDiskTarget(args[0]) && typeof golden === 'function') {
                    return golden.apply(this, args) as unknown;
                }
                const refusal = refuseValue?.(chai.util.flag(this, 'object'));
                if (refusal !== undefined) {
                    throw refusal;
                }
                return vitestToMatch.apply(this, args);
            },
    );
}
