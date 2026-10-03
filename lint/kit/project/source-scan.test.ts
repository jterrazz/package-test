import { describe, expect, test } from 'vitest';

import {
    argumentsOf,
    closingOf,
    HOLE,
    literalEnd,
    literalOf,
    stringsOf,
    withoutComments,
} from './source-scan.js';

describe('source-scan', () => {
    test.each([
        ['f(a, "x)", b)', 12],
        [String.raw`f(a, /\)/u, b)`, 13],
        [['f(`$', '{g(1)})`, b)'].join(''), 15],
        ['f([1, {a: (2)}])', 15],
        ['f(a', 3],
    ])(
        'the bracket opening %j closes at %i, past strings, regexes and nested brackets',
        (text, close) => {
            // Given - a call whose arguments hide closing brackets in literals
            // Then - the matching bracket is found, or the end of the text when none closes
            expect(closingOf(text, 1)).toBe(close);
        },
    );

    test('arguments split on the top-level commas only', () => {
        // Given - arguments holding commas inside strings, brackets and a regex
        const text = "'a,b', [1, 2], { c: 3, d: 4 }, /,/u, f(x, y)";

        // Then - five arguments, each trimmed
        expect(argumentsOf(text)).toStrictEqual([
            "'a,b'",
            '[1, 2]',
            '{ c: 3, d: 4 }',
            '/,/u',
            'f(x, y)',
        ]);
    });

    test('a slash opens a regex only where an expression may begin', () => {
        // Given - a division and a regex literal
        // Then - the division is no literal, the regex ends past its flags
        expect(literalEnd('a / b / c', 2)).toBe(2);
        expect(literalEnd('x = /a[/]b/gu;', 4)).toBe(13);
    });

    test.each([
        ["'users'", 'users'],
        ['"users"', 'users'],
        [['`/users/$', '{id}/posts`'].join(''), `/users/${HOLE}/posts`],
        ["'a' + b", undefined],
        ['name', undefined],
        [undefined, undefined],
    ])('the argument %j is the literal %j', (argument, literal) => {
        // Given - an argument as written
        // Then - its value when it is one whole string literal, an interpolation read as a hole
        expect(literalOf(argument)).toBe(literal);
    });

    test('comments are dropped, and a string that spells one is kept whole', () => {
        // Given - a glob that opens like a block comment, a line comment and a URL
        const source =
            "const glob = 'specs/lint/*' + '/*.yaml'; // a note\nconst url = 'http://x';";

        // Then - only the comment goes
        expect(withoutComments(source)).toBe(
            "const glob = 'specs/lint/*' + '/*.yaml'; \nconst url = 'http://x';",
        );
    });

    test('each character is marked inside a string or not, an escaped quote staying inside', () => {
        // Given - code around a string holding an escaped quote
        // Then - the quotes and everything between them are inside
        expect(stringsOf(String.raw`a 'b\'c' d`)).toStrictEqual([
            false,
            false,
            true,
            true,
            true,
            true,
            true,
            true,
            false,
            false,
        ]);
    });
});
