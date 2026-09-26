import { join, resolve } from 'node:path';

import { file, text } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { report } from './report.js';

/** The golden, resolved from this test, and by URL. */
const GOLDEN = resolve(import.meta.dirname, './expected/total.json');
const URL_GOLDEN = new URL('./expected/total.json', import.meta.url);

/** Paths built from pieces, and from `__dirname`: each is there. */
const JOINED = join(import.meta.dirname, 'expected', 'x.txt');
const CLIMBED = resolve(import.meta.dirname, '..', 'fixtures', 'gone');
const LEGACY = join(__dirname, './expected/total.json');
const PIECES = resolve(__dirname, 'expected', 'total.json');

/** A lone bare piece is a folder the test may make: `named-path-exists` does not read it, nor a path with a computed piece. */
const OUTPUT = resolve(import.meta.dirname, 'output');
const COMPUTED = join(import.meta.dirname, './missing/', 'folder', OUTPUT);

/** A path spelled into a command is the author's: `named-path-exists` does not read it. */
const COMMAND = 'node ./missing/tool.js';

/** A sample a test only TALKS about: a call written in a string is text. */
const SAMPLE = "expect(x).toMatch(file('./expected/sample.txt'));";

describe('report', () => {
test('reports the total', () => {
    // Given - the report of two rows
    // Then - it matches its golden, beside the module
    expect(text(report())).toMatch(file('./expected/total.json'));
    expect(SAMPLE).toContain('sample');
    expect(URL_GOLDEN.pathname.endsWith(GOLDEN.slice(-'total.json'.length))).toBe(true);
    expect(COMMAND).toContain('tool');
    expect([JOINED, CLIMBED, LEGACY, PIECES, OUTPUT, COMPUTED].join()).toContain('x.txt');
});
});
