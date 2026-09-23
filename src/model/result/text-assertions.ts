import { formatStdoutDiff } from '../chain/reporter.js';
import { isDiskTarget } from '../chain/spec-path.js';
import { dedent } from '../matching/dedent.js';
import { CaptureScope } from '../matching/match.js';
import { textEquals } from '../matching/structural.js';
import type { MatchFixtureOptions } from './match-options.js';
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
export type WholeCall = { options: MatchFixtureOptions | undefined; stack: string };

/** The options a caller handed, read without trusting their shape: `frozen` is the one they carry. */
function optionsOf(value: unknown): MatchFixtureOptions | undefined {
    return value !== null && typeof value === 'object'
        ? { frozen: Reflect.get(value, 'frozen') === true }
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
                    return golden.apply(this, args) as unknown;
                }
                const route = routeValue(chai.util.flag(this, 'object'), args[0]);
                if (route instanceof TypeError) {
                    throw route;
                }
                const whole = this[WHOLE_MATCHER];
                if (route === 'whole' && typeof whole === 'function') {
                    const stack = new Error('toMatch call site').stack ?? '';
                    const call: WholeCall = { options: optionsOf(args[1]), stack };
                    return whole.call(this, args[0], call) as unknown;
                }
                return vitestToMatch.apply(this, args);
            },
    );
}
