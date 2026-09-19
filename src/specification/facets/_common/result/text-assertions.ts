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
