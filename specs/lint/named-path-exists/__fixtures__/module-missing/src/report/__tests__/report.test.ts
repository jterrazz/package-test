import { join, resolve } from 'node:path';

import { file, text } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { report } from '../report.js';

/** The workspace the report reads, resolved from this test. */
const WORKSPACE = resolve(import.meta.dirname, './__fixtures__/workspace/');
const LOG = new URL('./__expected__/log.txt', import.meta.url);

/** The same paths built from pieces, and from `__dirname`: none of them is there. */
const JOINED = join(import.meta.dirname, '__expected__', 'x.txt');
const CLIMBED = resolve(import.meta.dirname, '..', '..', '__fixtures__', 'gone');
const LEGACY = join(__dirname, './__expected__/legacy.txt');
const PIECES = resolve(__dirname, '__seeds__', 'rows.sql');

/** A sample a test only TALKS about: a call written in a string is text. */
const SAMPLE = "expect(x).toMatch(file('./__expected__/sample.txt'));";

describe('report', () => {
test('reports the total', () => {
    // Given - the report of two rows
    // Then - it matches its golden, beside the module
    expect(text(report())).toMatch(file('./__expected__/total.json'));
    expect(SAMPLE).toContain('sample');
    expect(WORKSPACE).toContain('workspace');
    expect(LOG.pathname).toContain('log');
    expect([JOINED, CLIMBED, LEGACY, PIECES].join()).toContain('x.txt');
});
});
