import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('build', () => {
test('builds', async () => {
    // Given - an empty working directory
    const result = await cli.exec('build');

    // Then - the report, whole
    expect(result.stdout).toMatch(file('./expected/build.txt')); // checker-disable-line c28 -- an input tree of the c13-bare-ground spec: its file form is what the rule reads
});

test('a fixture named by a bare string is refused where it is written', () => {
    // Given - the 16 spelling, kept on purpose: the refusal is the behaviour
    // Then - refused at the call
    expect(() => cli.fixture('shop/' as never)).toThrow(/a string is a value/u);
});
});
