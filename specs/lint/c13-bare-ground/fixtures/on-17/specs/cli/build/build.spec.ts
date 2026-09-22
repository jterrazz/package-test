import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

test('builds', async () => {
    // Given - an empty working directory
    const result = await cli.exec('build');

    // Then - the report, whole
    expect(result.stdout).toMatch(file('./expected/build.txt'));
});

test('a fixture named by a bare string is refused where it is written', () => {
    // Given - the 16 spelling, kept on purpose: the refusal is the behaviour
    // Then - refused at the call
    expect(() => cli.fixture('shop/' as never)).toThrow(/a string is a value/u);
});
