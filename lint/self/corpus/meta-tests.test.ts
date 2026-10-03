import { spliceBetween } from '@jterrazz/typescript/rules';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { META_TESTS_MARKERS, metaTests, renderMetaTests } from './meta-tests.js';

const ROOT = resolve(import.meta.dirname, '../../..');

const CHAPTER = 'docs/03-testing.md';

describe('metaTests', () => {
    test('the meta-test channel, read off its own files — every file of the channel is a row, and every row states what it holds', () => {
        // Given - the channel as it stands on disk
        const rows = metaTests(ROOT);

        // Then - the three trees the channel lives in are all represented, and no row is a file with no describe and no test
        expect(rows.length).toBeGreaterThan(15);
        expect(rows.some((row) => row.file.startsWith('lint/self/'))).toBe(true);
        expect(rows.some((row) => row.file.startsWith('specs/lint/meta/'))).toBe(true);
        expect(
            rows.filter((row) => row.holds.length === 0 || row.tests === 0).map((row) => row.file),
        ).toStrictEqual([]);
    });

    test('the meta-test channel, read off its own files — this file is one of the rows, under the title it declares', () => {
        // Given - the channel's own reading of the file you are looking at
        const own = metaTests(ROOT).find(
            (row) => row.file === 'lint/self/corpus/meta-tests.test.ts',
        );

        // Then - the row carries this file's describe, the subject `one-describe-per-file` titles it with
        expect(own?.holds).toStrictEqual(['metaTests']);
    });

    test('the meta-test channel, read off its own files — the table in chapter 03 is byte-identical to a fresh generation', () => {
        // Given - the committed chapter
        const chapter = readFileSync(resolve(ROOT, CHAPTER), 'utf8');

        // Then - regenerating reproduces it: a hand edit between the markers fails here, correctly
        expect(spliceBetween(chapter, META_TESTS_MARKERS, renderMetaTests(ROOT), CHAPTER)).toBe(
            chapter,
        );
    });
});
