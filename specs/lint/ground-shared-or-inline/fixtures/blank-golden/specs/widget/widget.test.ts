import { file, text } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

describe('widget', () => {
test('a blank golden', () => {
    expect(text('\n\n\n')).toMatch(file('./expected/blank.txt'));
});
});
