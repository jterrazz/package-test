import { file, text } from '@jterrazz/test';
import { expect, test } from 'vitest';

test('a golden a module test reads too', () => {
    // Given - the line
    // Then - it matches the golden the module test also reads
    expect(text('one line')).toMatch(file('./expected/line.txt'));
});
