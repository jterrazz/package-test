import { join, resolve } from 'node:path';

import { file, text } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { report } from './report.js';

/** The workspace the report reads, resolved from this test. */
const WORKSPACE = resolve(import.meta.dirname, './_fixtures/workspace/');
const LOG = new URL('./_expected/log.txt', import.meta.url);

/** The same paths built from pieces, and from `__dirname`: none of them is there. */
const JOINED = join(import.meta.dirname, '_expected', 'x.txt');
const CLIMBED = resolve(import.meta.dirname, '..', '_fixtures', 'gone');
const LEGACY = join(__dirname, './_expected/legacy.txt');
const PIECES = resolve(__dirname, '_seeds', 'rows.sql');

/** A sample a test only TALKS about: a call written in a string is text. */
const SAMPLE = "expect(x).toMatch(file('./_expected/sample.txt'));";

describe('report', () => {
test('reports the total', () => {
    // Given - the report of two rows
    // Then - it matches its golden, beside the module
    expect(text(report())).toMatch(file('./_expected/total.json'));
    expect(SAMPLE).toContain('sample');
    expect(WORKSPACE).toContain('workspace');
    expect(LOG.pathname).toContain('log');
    expect([JOINED, CLIMBED, LEGACY, PIECES].join()).toContain('x.txt');
});
});
