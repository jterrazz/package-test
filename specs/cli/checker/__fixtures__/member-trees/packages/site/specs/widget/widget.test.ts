import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

describe('widget', () => {
    test('a short golden', () => {
        expect('ready').toMatch(file('./__expected__/ready.txt'));
    });
});
