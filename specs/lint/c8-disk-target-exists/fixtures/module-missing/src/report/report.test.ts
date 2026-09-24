import { resolve } from 'node:path';

import { file, text } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { report } from './report.js';

/** The workspace the report reads, resolved from this test. */
const WORKSPACE = resolve(import.meta.dirname, './fixtures/workspace/');
const LOG = new URL('./expected/log.txt', import.meta.url);

/** A sample a test only TALKS about: a call written in a string is text. */
const SAMPLE = "expect(x).toMatch(file('./expected/sample.txt'));";

test('reports the total', () => {
    // Given - the report of two rows
    // Then - it matches its golden, beside the module
    expect(text(report())).toMatch(file('./expected/total.json'));
    expect(SAMPLE).toContain('sample');
    expect(WORKSPACE).toContain('workspace');
    expect(LOG.pathname).toContain('log');
});
