import { file } from '@jterrazz/test'; // checker-disable-line spec-in-subject-folder -- an input of ground-uses-reserved-name: this folder is the case the rule reads, not a subject's standard name
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('refusal', () => {
test('a fixture named by a bare string is refused where it is written', async () => {
    // Given - the 16 spelling, kept on purpose: the refusal is the behaviour
    const result = await cli.exec('refuse');

    // Then - refused at the call, and the report says so
    expect(() => cli.fixture('shop/' as never)).toThrow(/a string is a value/u);
    expect(result.stdout).toMatch(file('./expected/refused.txt')); // checker-disable-line ground-shared-or-inline -- an input tree of the ground-uses-reserved-name spec: its file form is what the rule reads
});
});
