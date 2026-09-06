import { describe, expect, test } from 'vitest';

import { CaptureScope } from '../../matching/match.js';
import { textEquals } from '../../matching/structural.js';
import { formatStdoutDiff } from './reporter.js';

/** The diff as a reader sees it, ANSI stripped. */
// eslint-disable-next-line no-control-regex
const plain = (text: string): string[] => text.replace(/\x1b\[[0-9;]*m/g, '').split('\n');

const tokenAware = (expected: string, actual: string): boolean =>
    textEquals(expected, actual, new CaptureScope());

describe('formatStdoutDiff — only the real cause is marked', () => {
    test('a token line that matched renders as equal, keeping its token', () => {
        // Given - a golden whose first line is a {{url}} the run satisfied, and
        // Whose second line is the genuine mismatch
        const expected = 'backend {{url}}\nstatus ready';
        const actual = 'backend http://127.0.0.1:63810/mcp\nstatus degraded';

        // Then - the url line is unmarked and shows the TOKEN; only the status
        // Line carries the - / + pair
        const lines = plain(formatStdoutDiff('stdout', expected, actual, { equals: tokenAware }));
        expect(lines).toContain('  backend {{url}}');
        expect(lines).toContain('- status ready');
        expect(lines).toContain('+ status degraded');
        expect(lines).not.toContain('- backend {{url}}');
    });

    test('without a token-aware equality every differing line is marked (pinned)', () => {
        // Given - the same pair, compared strictly (the default)
        const lines = plain(
            formatStdoutDiff('stdout', 'backend {{url}}', 'backend http://127.0.0.1:1/'),
        );

        // Then - strict equality has no notion of a token
        expect(lines).toContain('- backend {{url}}');
    });

    test('a diff that would mark nothing falls back to strict rendering', () => {
        // Given - two texts every line of which the token-aware pass accepts,
        // Which happens when the real cause is a cross-line #ref conflict
        const lines = plain(
            formatStdoutDiff('stdout', 'id {{int#a}}\nid {{int#a}}', 'id 1\nid 2', {
                equals: tokenAware,
            }),
        );

        // Then - the reader is shown something rather than a clean block
        expect(lines).toContain('- id {{int#a}}');
        expect(lines).toContain('+ id 1');
    });
});
