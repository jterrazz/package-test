import { describe, expect, test } from 'vitest';

import { dedent } from './dedent.js';

describe('dedent — a value written in place, read as the text it states', () => {
    test('a text opening on a line break loses it, the closing line, and the shared indentation', () => {
        // Given - a block indented with the code around it
        const written = `
            HTTP/1.1 200 OK

              {"ok": true}
        `;

        // Then - the value, each line kept relative to the least indented one, the blank line kept
        expect(dedent(written)).toBe('HTTP/1.1 200 OK\n\n  {"ok": true}\n');
    });

    test('a block whose closing backtick follows its last line states no final line break', () => {
        // Given - the closing backtick on the last line
        const written = `
            first
            last`;

        // Then - no line break after the last line
        expect(dedent(written)).toBe('first\nlast');
    });

    test('a text that does not open on a line break is the value exactly as written', () => {
        // Given - a one-line text, and one whose lines are indented on purpose
        // Then - untouched
        expect(dedent('  kept as written  ')).toBe('  kept as written  ');
        expect(dedent('a\n    b\n')).toBe('a\n    b\n');
    });

    test('a whitespace-only line inside the block keeps what lies past the indentation', () => {
        // Given - an interior line of spaces deeper than the block's indentation
        const written = '\n    a\n      \n    b\n';

        // Then - its two spaces past the indentation stay; the empty text stays empty
        expect(dedent(written)).toBe('a\n  \nb\n');
        expect(dedent('\n')).toBe('');
    });
});
