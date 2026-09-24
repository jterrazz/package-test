import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

/** The golden the spec compares, read from this module test too. */
const LINE = resolve(import.meta.dirname, '../../specs/notes/expected/line.txt');

test('reads the line', () => {
    // Given - the golden
    // Then - it holds the line
    expect(readFileSync(LINE, 'utf8')).toBe('one line\n');
});
