import { file, text } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

describe('widget', () => {
test('an indented JSON golden', () => {
    expect(text('{}')).toMatch(file('./__expected__/state.json'));
});
});
