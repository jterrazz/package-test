import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

test('reads a golden beside it, the layout before __tests__/', () => {
    // Then - the golden beside the test
    expect('old').toMatch(file('./__expected__/old.txt'));
});
