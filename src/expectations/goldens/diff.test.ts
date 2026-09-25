import { describe, expect, test } from 'vitest';

import { CaptureScope } from '../tokens/match.js';
import { textEquals } from '../tokens/structural.js';
import { formatResponseDiff, formatStdoutDiff } from './diff.js';

/** The diff as a reader sees it, ANSI stripped. */
const plain = (text: string): string[] => text.replaceAll(/\u001B\[[0-9;]*m/gu, '').split('\n');

const tokenAware = (expected: string, actual: string): boolean =>
    textEquals(expected, actual, new CaptureScope());

describe('formatStdoutDiff — only the real cause is marked', () => {
    test('a token line that matched renders as equal, keeping its token', () => {
        // Given - a golden whose first line is a {{url}} the run satisfied, and whose second line is the genuine mismatch
        const expected = 'backend {{url}}\nstatus ready';
        const actual = 'backend http://127.0.0.1:63810/mcp\nstatus degraded';

        // Then - the url line is unmarked and shows the TOKEN; only the status line carries the - / + pair
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
        // Given - two texts every line of which the token-aware pass accepts, which happens when the real cause is a cross-line #ref conflict
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

describe('formatResponseDiff — a body read the way it was written', () => {
    test('a text body is diffed line by line, as its own lines', () => {
        // Given - an HTML page whose heading changed
        const expected = '<main>\n    <h1>Welcome</h1>\n</main>';
        const actual = '<main>\n    <h1>Goodbye</h1>\n</main>';

        // Then - the page's lines, only the heading marked
        expect(plain(formatResponseDiff('page.http', expected, actual)).slice(5)).toStrictEqual([
            '  <main>',
            '-     <h1>Welcome</h1>',
            '+     <h1>Goodbye</h1>',
            '  </main>',
        ]);
    });

    test('a JSON value is diffed as its pretty-printed lines', () => {
        // Given - one field of an object changed
        const lines = plain(formatResponseDiff('user.http', { name: 'Alice' }, { name: 'Bob' }));

        // Then - the object's lines, only the field marked
        expect(lines.slice(5)).toStrictEqual([
            '  {',
            '-   "name": "Alice"',
            '+   "name": "Bob"',
            '  }',
        ]);
    });

    test('a text against a value that is not text shows both as JSON, so the kinds differ visibly', () => {
        // Given - a number where the text "42" was expected
        const lines = plain(formatResponseDiff('count.http', '42', 42));

        // Then - the quotes say which side is text
        expect(lines.slice(5)).toStrictEqual(['- "42"', '+ 42']);
    });
});
