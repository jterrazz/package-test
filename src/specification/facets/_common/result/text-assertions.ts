import { CaptureScope } from '../../../matching/match.js';
import { textEquals } from '../../../matching/structural.js';
import { formatStdoutDiff } from '../reporter.js';
import type { TextAccessor } from './text.js';

/**
 * What a stream assertion DECIDES, with no idea of where the fixture came from.
 *
 * A golden is read from disk under node and through a server command from
 * inside a page — two transports, one comparison. Keeping the judgement here,
 * pure, is what makes `expect(result.stdout).toMatch('help.txt')` and
 * `expect(result.tree).toMatch('table.aria.yaml')` the same assertion with the
 * same diff, instead of two implementations that drift a token at a time.
 */

/** A matcher's verdict: the boolean vitest reads, and the message it prints. */
export type TextComparison = {
    message: () => string;
    pass: boolean;
};

/** The fixture name carries its extension — the name IS the file. */
export function requireExtension(name: string, subject: string): void {
    if (!/\.[A-Za-z0-9]+$/u.test(name)) {
        throw new Error(
            `toMatch("${name}"): the extension is part of the name and is required for ${subject} subjects (e.g. "help.txt").`,
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
    const actual = accessor.comparableText;
    if (textEquals(expected, actual, accessor.captures)) {
        return {
            message: () => `expected ${accessor.streamName} not to match _expected/${name}`,
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

/** `expect(stream).toBeEmpty()` — the stream you usually want silent. */
export function textIsEmpty(accessor: TextAccessor): TextComparison {
    const content = accessor.comparableText;
    const pass = content === '';
    return {
        message: () =>
            pass
                ? `expected ${accessor.streamName} not to be empty`
                : `Expected ${accessor.streamName} to be empty, but it contains:\n${content}`,
        pass,
    };
}

/** `expect(stream).toContain('…')` — the scalpel, never the default (D11). */
export function textContains(accessor: TextAccessor, expected: string): TextComparison {
    const actual = accessor.comparableText;
    const pass = actual.includes(expected);
    return {
        message: () =>
            pass
                ? `expected ${accessor.streamName} not to contain ${JSON.stringify(expected)}`
                : `${accessor.streamName} does not contain expected substring.\n` +
                  `  expected to contain: ${JSON.stringify(expected)}\n` +
                  `  actual: ${JSON.stringify(actual.length > 500 ? `${actual.slice(0, 500)}…` : actual)}`,
        pass,
    };
}

/**
 * `toMatch` and `toContain` on a subject that is NOT an accessor.
 *
 * Both matchers are overridden globally, for every subject in the project, so
 * whatever the framework does not own has to keep meaning what vitest's own
 * matcher meant. Stated once here because the two builds register two different
 * `expect.extend` calls: a copy in the page is how `expect(['ab']).toContain('b')`
 * ends up passing on one side of the seam and failing on the other.
 */

/** vitest's `toMatch` for a plain string: a substring, or a regular expression. */
export function nativeMatch(received: unknown, expected: unknown): TextComparison {
    if (typeof received !== 'string') {
        throw new TypeError(
            'toMatch: unsupported subject — expected a stream, json, response, filesystem, or directory accessor, or a string.',
        );
    }
    const pass =
        expected instanceof RegExp ? expected.test(received) : received.includes(String(expected));
    return {
        message: () =>
            `expected ${JSON.stringify(received)} ${pass ? 'not ' : ''}to match ${String(expected)}`,
        pass,
    };
}

/** vitest's `toContain` for a plain string (substring) or an iterable (membership). */
export function nativeContain(received: unknown, expected: unknown): TextComparison {
    if (typeof received === 'string') {
        const pass = received.includes(String(expected));
        return {
            message: () =>
                `expected ${JSON.stringify(received)} ${pass ? 'not ' : ''}to contain ${JSON.stringify(expected)}`,
            pass,
        };
    }
    if (isIterable(received)) {
        const pass = [...received].includes(expected);
        return {
            message: () =>
                `expected iterable ${pass ? 'not ' : ''}to contain ${JSON.stringify(expected)}`,
            pass,
        };
    }
    throw new TypeError(
        `toContain: unsupported subject of type ${typeof received} — expected a stream accessor, string, or iterable.`,
    );
}

/** Does this value hand out its members? A Set and an array both do; a DOM node does not. */
function isIterable(value: unknown): value is Iterable<unknown> {
    return (
        value !== null &&
        value !== undefined &&
        typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function'
    );
}
