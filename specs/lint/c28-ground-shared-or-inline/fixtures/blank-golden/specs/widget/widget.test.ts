import { file, text } from '@jterrazz/test';
import { expect, test } from 'vitest';

test('a blank golden', () => {
    expect(text('\n\n\n')).toMatch(file('./expected/blank.txt'));
});
