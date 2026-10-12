import { describe, expect, test } from 'vitest';

import {
    isFrozen,
    replacementOf,
    survivesInPlace,
    valueLines,
} from '../ground-shared-or-inline.forms.js';

const HOLE = ['$', '{d}'].join('');

describe('ground-shared-or-inline.forms', () => {
    test('a request file is written in place as a dedented template', () => {
        // Given - a two-line request read by `.request(`
        const content = 'GET /orders\nAccept: text/plain\n';

        // Then - a template literal indented under the call, its closing newline kept
        expect(replacementOf('await api.request(', content, '/x/list.http', '    ')).toBe(
            ['`', '        GET /orders', '        Accept: text/plain', '    `'].join('\n'),
        );
    });

    test('a JSON body is written as the value it parses to, and any other body as a string', () => {
        // Given - the same text posted from a .json and from a .txt
        const before = "await api.post('/orders', ";

        // Then - a value from JSON, a quoted line otherwise
        expect(replacementOf(before, '{"item":"book"}', '/x/order.json', '')).toBe(
            '{\n    "item": "book"\n}',
        );
        expect(replacementOf(before, 'item=book', '/x/order.txt', '')).toBe('"item=book"');
    });

    test('a golden is a value under a JSON accessor, text under any other, and a call no form reads is left alone', () => {
        // Given - the same JSON golden matched by a JSON accessor and by a text one, and a call no form reads
        // Then - the value, the text, then nothing to write
        expect(replacementOf('expect(result.json).toMatch(', '[1]', '/x/a.json', '')).toBe(
            '[\n    1\n]',
        );
        expect(replacementOf('expect(result.text).toMatch(', '[1]', '/x/a.json', '')).toBe('`[1]`');
        expect(replacementOf('await other(', 'x', '/x/a.txt', '')).toBeUndefined();
    });

    test('a text survives in place unless it opens on a line break its lines share an indentation after', () => {
        // Given - one line, lines a template keeps, lines only the quoted form keeps, a text opening on a break flush left, and a cobra banner opening on a break, indented
        // Then - only the banner has no literal the comparison's dedent leaves equal
        expect([
            survivesInPlace('done'),
            survivesInPlace('a\n  b\n'),
            survivesInPlace('  a\n  b'),
            survivesInPlace('  indented'),
            survivesInPlace('\nDone\n'),
            survivesInPlace('\n  ✓ Created\n  ✓ Started\n'),
        ]).toStrictEqual([true, true, true, true, true, false]);
    });

    test('a value counts its lines without its closing newline', () => {
        // Given - one line with and without its newline, and two lines
        // Then - the newline that closes a file is no line
        expect([
            valueLines('a'),
            valueLines('a\n'),
            valueLines('a\nb\n'),
            valueLines('a\nb'),
        ]).toStrictEqual([1, 1, 2, 2]);
    });

    test.each([
        [
            'a request split over lines',
            'await api.request(\n        ',
            'GET /x\n',
            '/x/a.http',
            '`\n    GET /x\n`',
        ],
        [
            'a request with a space before its paren',
            'await api.request (',
            'GET /x',
            '/x/a.http',
            '`GET /x`',
        ],
        [
            'a request named before another call',
            'api.request(a);\nawait other(',
            'x',
            '/x/a.txt',
            undefined,
        ],
        [
            'a body after a split argument list',
            "await api.put('/x',\n    ",
            '{"a":1}',
            '/x/a.json',
            '{\n    "a": 1\n}',
        ],
        ['a body with a space before its paren', "await api.put ('/x', ", 'x', '/x/a.txt', '"x"'],
        [
            'JSON text posted from a text file',
            "await api.post('/x', ",
            '{"a":1}',
            '/x/a.txt',
            JSON.stringify('{"a":1}'),
        ],
        ['a golden split over lines', 'expect(text).toMatch(\n    ', 'x', '/x/a.txt', '`x`'],
        [
            'a golden with a space before its paren',
            'expect(text).toMatch (',
            'x',
            '/x/a.txt',
            '`x`',
        ],
        [
            'no JSON under a JSON accessor',
            'expect(result.json).toMatch(',
            'not json',
            '/x/a.json',
            undefined,
        ],
        ['a JSON golden matched on no call', 'chain.toMatch(', '[1]', '/x/a.json', undefined],
        [
            'a JSON golden matched on no call after one that was',
            'expect(a).toMatch(x);\nchain.toMatch(',
            '[1]',
            '/x/a.json',
            undefined,
        ],
        [
            'a JSON golden matched, negated, on a call spaced out',
            'expect(text) .not .toMatch (',
            '[1]',
            '/x/a.json',
            '`[1]`',
        ],
        ['a text golden matched on no call', 'chain.toMatch(', '[1]', '/x/a.txt', '`[1]`'],
        [
            'a body named before another call',
            "api.post('/x', a);\nawait other(",
            'x',
            '/x/a.txt',
            undefined,
        ],
        [
            'a JSON golden matched, negated, on a call',
            'expect(text).not.toMatch(',
            '[1]',
            '/x/a.json',
            '`[1]`',
        ],
    ])('%s is written as its form', (...[, before, content, target, written]) => {
        // Given - the text before a file() call, and the file's content
        // Then - what the fixer writes in its place, or nothing
        expect(replacementOf(before, content, target, '')).toBe(written);
    });

    test('a block escapes what a template reads, keeps blank lines bare, and falls back to a string where dedent would change it', () => {
        // Given - text holding a backslash, a backtick and a hole, text ending on no newline, and text closing on a line of spaces
        // Then - each written so it reads back as itself
        expect([
            replacementOf(
                'api.request(',
                [String.raw`a\b`, '`c`', HOLE, ''].join('\n'),
                '/x/a.http',
                '',
            ),
            replacementOf('api.request(', 'a\n\nb', '/x/a.http', ''),
            replacementOf('api.request(', 'a\n  ', '/x/a.http', ''),
        ]).toStrictEqual([
            ['`', String.raw`    a\\b`, String.raw`    \`c\``, `    \\${HOLE}`, '`'].join('\n'),
            ['`', '    a', '', '    b`'].join('\n'),
            JSON.stringify('a\n  '),
        ]);
    });

    test('a golden compared frozen is recognised by the call it is read by, whatever the spacing', () => {
        // Given - the tail of a call that states the bytes as the contract, in three spacings, and tails that do not
        // Then - the first are frozen, the others are not
        expect(
            [
                ', { frozen: true })',
                ' , {\n frozen : true,\n })',
                ',{frozen:true}',
                ')',
                ', { frozen: false })',
                ', { other: true })',
                ', frozen: true })',
                'x, { frozen: true })',
            ].map((tail) => isFrozen(tail)),
        ).toStrictEqual([true, true, true, false, false, false, false, false]);
    });
});
