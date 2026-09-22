import { file, text } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { report } from './report.js';

/** A sample a test only TALKS about: a call written in a string is text. */
const SAMPLE = "expect(x).toMatch(file('./expected/sample.txt'));";

test('reports the total', () => {
    // Given - the report of two rows
    // Then - it matches its golden, beside the module
    expect(text(report())).toMatch(file('./expected/total.json'));
    expect(SAMPLE).toContain('sample');
});
