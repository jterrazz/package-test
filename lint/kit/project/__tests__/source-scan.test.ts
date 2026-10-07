import { describe, expect, test } from 'vitest';

import {
    argumentsOf,
    closingOf,
    HOLE,
    literalEnd,
    literalOf,
    skipString,
    stringsOf,
    withoutComments,
} from '../source-scan.js';

/** `#{` spells an interpolation, which a plain string cannot hold. */
const spelled = (text: string): string => text.replaceAll('#{', ['$', '{'].join(''));

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

    test.each([
        [String.raw`'a\'b'x`, 6],
        ["`a#{'}'}b`x", 10],
        ['`$a{b}`x', 7],
        ["'a#{b'x", 6],
        ['"open', 5],
        ['`a#{"`"}b`x', 10],
        ['`#{`a`}b`', 9],
        ['`a{b`x', 5],
        ['`$x`y', 4],
    ])('the string %j ends at %i, past escapes and interpolations', (written, end) => {
        // Given - a string as written, `#{` an interpolation
        // Then - its end, or the text's end when it never closes
        expect(skipString(spelled(written), 0)).toBe(end);
    });

    test.each([
        ['a / b / cccccccccccccccccccccc', 2, 2],
        [String.raw`(/a\/b/g) + 1`, 1, 8],
        ['(/a\nb/)', 1, 1],
        ['(//x', 1, 1],
        ['(/*x*/', 1, 1],
        ["'s' + 1", 0, 3],
    ])(
        'the literal at %j:%i ends at %i, a regex only where an expression begins',
        (text, start, end) => {
            // Given - a division, regexes closed or not, comments and a string
            // Then - where the literal ends, or its start when none opens there
            expect(literalEnd(text, start)).toBe(end);
        },
    );

    test('arguments drop a trailing comma, and a literal is read whole, trimmed, holes only in a template', () => {
        // Given - arguments one per line with a trailing comma, literals padded and quoted every way
        const written = ['  "a"  ', "'a#{b}'", '`a#{b}`'];

        // Then - two arguments, and each literal as its quote reads it
        expect([
            argumentsOf('\n    a,\n    b,\n'),
            written.map((one) => literalOf(spelled(one))),
        ]).toStrictEqual([
            ['a', 'b'],
            ['a', spelled('a#{b}'), `a${HOLE}`],
        ]);
    });

    test('comments end at the text’s end when they never close, and a block opened by its own slash runs to its close', () => {
        // Given - comments at the end of the text, and one written /*/
        const sources = [
            'a // c',
            'a /* c',
            'a /*/ b */ c',
            String.raw`s = 'x\'// y' // z`,
            "s = 'open",
            'x:// y',
            '//c\nx',
        ];

        // Then - only what no comment holds remains
        expect(sources.map(withoutComments)).toStrictEqual([
            'a ',
            'a ',
            'a  c',
            String.raw`s = 'x\'// y' `,
            "s = 'open",
            'x:// y',
            '\nx',
        ]);
    });
});
