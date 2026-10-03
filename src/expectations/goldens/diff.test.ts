import { stripVTControlCharacters } from 'node:util';
import { describe, expect, test } from 'vitest';

import { CaptureScope } from '../tokens/capture-scope.js';
import { textEquals } from '../tokens/structural.js';
import { TREE_DIFF, TREE_DIFF_LINES } from './diff.fixtures.js';
import {
    formatDirectoryDiff,
    formatResponseDiff,
    formatStdoutDiff,
    formatTableDiff,
} from './diff.js';

const plain = (text: string): string[] => stripVTControlCharacters(text).split('\n');

const tokenAware = (expected: string, actual: string): boolean =>
    textEquals(expected, actual, new CaptureScope());

function tokenAwareLines(expected: string, actual: string): string[] {
    return plain(formatStdoutDiff('stdout', expected, actual, { equals: tokenAware })).slice(5);
}

describe('diff', () => {
    test('formatStdoutDiff — only the real cause is marked — a token line that matched renders as equal, keeping its token', () => {
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

    test('formatStdoutDiff — only the real cause is marked — without a token-aware equality every differing line is marked (pinned)', () => {
        // Given - the same pair, compared strictly (the default)
        const lines = plain(
            formatStdoutDiff('stdout', 'backend {{url}}', 'backend http://127.0.0.1:1/'),
        );

        // Then - strict equality has no notion of a token
        expect(lines).toContain('- backend {{url}}');
    });

    test('formatStdoutDiff — only the real cause is marked — a line one side lacks is marked on the side that has it, token-aware or not', () => {
        // Given - outputs one line longer on each side, compared token-aware

        // Then - the extra line marked alone
        expect([
            tokenAwareLines('id {{int}}\nmore', 'id 1'),
            tokenAwareLines('id {{int}}', 'id 1\nmore'),
        ]).toStrictEqual([
            ['  id {{int}}', '- more'],
            ['  id {{int}}', '+ more'],
        ]);
    });

    test('formatStdoutDiff — only the real cause is marked — a diff that would mark nothing falls back to strict rendering', () => {
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

    test('formatResponseDiff — a body read the way it was written — a text body is diffed line by line, as its own lines', () => {
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

    test('formatResponseDiff — a body read the way it was written — a JSON value is diffed as its pretty-printed lines', () => {
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

    test('formatResponseDiff — a body read the way it was written — a text against a value that is not text shows both as JSON, so the kinds differ visibly', () => {
        // Given - a number where the text "42" was expected
        const lines = plain(formatResponseDiff('count.http', '42', 42));

        // Then - the quotes say which side is text, whichever side holds it
        expect([
            lines.slice(5),
            plain(formatResponseDiff('count.http', 42, '42')).slice(5),
        ]).toStrictEqual([
            ['- "42"', '+ 42'],
            ['- 42', '+ "42"'],
        ]);
    });

    test('formatResponseDiff — a body read the way it was written — lines past the end of either side are marked on their side alone', () => {
        // Given - an expected body longer than the received one, and the other way round
        // Then - each extra line marked as removed or added
        expect([
            plain(formatResponseDiff('a.http', 'one\ntwo\nthree', 'one')).slice(5),
            plain(formatResponseDiff('b.http', 'one', 'one\ntwo')),
        ]).toStrictEqual([
            ['  one', '- two', '- three'],
            ['Response mismatch (b.http)', '', '- Expected', '+ Received', '', '  one', '+ two'],
        ]);
    });

    test('formatStdoutDiff — the whole message — its header, then each line kept or marked', () => {
        // Given - an output that lost its last line and changed its first
        // Then - the whole message
        expect(plain(formatStdoutDiff('stdout', 'a\nb\nc', 'x\nb'))).toStrictEqual([
            'Output mismatch (stdout)',
            '',
            '- Expected',
            '+ Received',
            '',
            '- a',
            '+ x',
            '  b',
            '- c',
        ]);
    });

    test('formatTableDiff — the rows of a table — matched, missing and unexpected rows, each cell written as text', () => {
        // Given - a table with a matched row, a row only expected, a row only received, and cells of every kind
        const pairs = [
            { actual: [1, 'Ada'], expected: [1, 'Ada'], matched: true },
            { expected: [2, null], matched: false },
            {
                actual: [
                    3,
                    undefined,
                    new Date('2024-01-02T03:04:05.000Z'),
                    true,
                    10n,
                    { a: 1 },
                    () => 1,
                ],
                matched: false,
            },
            { actual: [4, 'Bo'], expected: [4, 'Al'], matched: false },
        ];

        // Then - the whole table, counted in rows
        expect(plain(formatTableDiff('users', ['id', 'name'], pairs))).toStrictEqual([
            'Table "users" mismatch',
            '  query: id, name',
            '  expected: 3 rows',
            '  received: 3 rows',
            '',
            '- Expected',
            '+ Received',
            '',
            '  id  |  name',
            '  1  |  Ada',
            '- 2  |  null',
            '+ 3  |  null  |  2024-01-02T03:04:05.000Z  |  true  |  10  |  {"a":1}  |  null',
            '- 4  |  Al',
            '+ 4  |  Bo',
        ]);
    });

    test('formatTableDiff — the rows of a table — one row is counted as one, and no rows at all says so', () => {
        // Given - a table expecting one row and receiving none
        // Then - the counts in the singular, and an empty table marked empty
        expect([
            plain(formatTableDiff('t', ['id'], [{ expected: [1], matched: false }])).slice(2, 4),
            plain(formatTableDiff('t', ['id'], [])).slice(2),
        ]).toStrictEqual([
            ['  expected: 1 row', '  received: 0 rows'],
            [
                '  expected: 0 rows',
                '  received: 0 rows',
                '',
                '- Expected',
                '+ Received',
                '',
                '  id',
                '  (empty)',
            ],
        ]);
    });

    test('formatDirectoryDiff — a generated tree against its fixture — added, removed and changed files, five changed lines shown at most', () => {
        // Given - a tree with an added file, a removed one, a file with one changed line and one with seven
        // Then - the whole message, the second file cut after five lines
        expect(plain(formatDirectoryDiff('tree', TREE_DIFF, 'run with -u'))).toStrictEqual(
            TREE_DIFF_LINES,
        );
    });

    test('formatDirectoryDiff — a generated tree against its fixture — one difference is counted as one', () => {
        // Given - a tree whose one file went missing
        const diff = { added: [], changed: [], removed: ['gone.txt'] };

        // Then - the count in the singular
        expect(plain(formatDirectoryDiff('tree', diff, 'hint'))[1]).toBe(
            '  1 difference: 0 added, 1 removed, 0 changed',
        );
    });
});
