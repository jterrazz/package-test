import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

const GOLDEN = './_fixtures/in-place/recorded.test.mjs';
const WHY =
    'why: `toMatch` on a result the framework produced compares the WHOLE result, to a value written in place or to a `file()`/`directory()` golden.';
const READ = 'read: docs/reference/linting.md#one-verb-per-meaning';

describe('value', () => {
    test('a stream read as its text holds no golden: a file handed to its toMatch is refused, naming the subjects that do', async () => {
        // Given - a run whose stdout the test reads as its text
        const result = await cli.exec('build');

        // Then - refused before any golden is read
        expect(() => {
            // @ts-expect-error -- a golden the types refuse on a value, refused at run time too
            expect(result.stdout.text).toMatch(file(GOLDEN));
        }).toThrow(
            [
                `found: toMatch(file("${GOLDEN}")) on a subject that holds no file of its kind`,
                WHY,
                'fix: compare a stream, a json or a response to its file; a directory or the working directory is `await toMatch(directory(…))`',
                READ,
            ].join('\n'),
        );
    });

    test('a plain string matched against a file is refused rather than read as a pattern', async () => {
        // Given - a string the test built from a run, read with the pattern a path object would be
        const result = await cli.exec('build');
        const firstLine = result.stdout.text.split('\n')[0] ?? '';

        // Then - no pattern is made of the path: the string is told how to golden it
        // @ts-expect-error -- a golden the types refuse on a value, refused at run time too
        expect(() => firstLine.match(file(GOLDEN))).toThrow(
            [
                `found: toMatch(file("${GOLDEN}")) on a string, a value with no golden`,
                WHY,
                "fix: wrap the string to golden it — `expect(text(value)).toMatch(file(…))` — or compare it to a value, `toMatch('…')`",
                READ,
            ].join('\n'),
        );
    });
});
