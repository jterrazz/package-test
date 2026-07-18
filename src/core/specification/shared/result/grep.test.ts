import { describe, expect, test } from 'vitest';

import { grep } from './grep.js';

describe('grep', () => {
    test('returns only the blocks containing the pattern', () => {
        // Given - three blank-line-separated blocks, two matching
        const output = 'a.ts\n  error one\n\nb.ts\n  fine\n\nc.ts\n  error two';

        // Then - non-matching blocks are dropped, matches joined with a blank line
        expect(grep(output, 'error')).toBe('a.ts\n  error one\n\nc.ts\n  error two');
    });

    test('strips ANSI codes before matching', () => {
        // Given - a block whose pattern is wrapped in ANSI escapes
        const output = '\x1b[31mbroken.ts\x1b[0m\n  no-unused-vars';

        // Then - the pattern matches the clean text and the result is clean
        expect(grep(output, 'broken.ts')).toBe('broken.ts\n  no-unused-vars');
    });

    test('splits blocks on whitespace-only lines', () => {
        // Given - two matching blocks separated by a line of spaces
        const output = 'x match\n   \ny match';

        // Then - both survive as separate blocks rejoined with \n\n
        expect(grep(output, 'match')).toBe('x match\n\ny match');
    });

    test('returns an empty string when nothing matches', () => {
        // Given - output without the pattern
        // Then - the result is empty
        expect(grep('clean output', 'error')).toBe('');
    });
});
