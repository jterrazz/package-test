import { describe, expect, test } from 'vitest';

import { replacementOf, valueLines } from './ground-shared-or-inline.forms.js';

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

    test('a value counts its lines without its closing newline', () => {
        // Given - one line with and without its newline, and two lines
        // Then - the newline that closes a file is no line
        expect([valueLines('a'), valueLines('a\n'), valueLines('a\nb\n')]).toStrictEqual([1, 1, 2]);
    });
});
