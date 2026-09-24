import { resolve } from 'node:path';

import { file, text } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { report } from './report.js';

/** The golden, resolved from this test, and by URL. */
const GOLDEN = resolve(import.meta.dirname, './expected/total.json');
const URL_GOLDEN = new URL('./expected/total.json', import.meta.url);

/** A path spelled into a command is the author's: C8 does not read it. */
const COMMAND = 'node ./missing/tool.js';

/** A sample a test only TALKS about: a call written in a string is text. */
const SAMPLE = "expect(x).toMatch(file('./expected/sample.txt'));";

test('reports the total', () => {
    // Given - the report of two rows
    // Then - it matches its golden, beside the module
    expect(text(report())).toMatch(file('./expected/total.json'));
    expect(SAMPLE).toContain('sample');
    expect(URL_GOLDEN.pathname.endsWith(GOLDEN.slice(-'total.json'.length))).toBe(true);
    expect(COMMAND).toContain('tool');
});
