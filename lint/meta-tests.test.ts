import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { META_TESTS_END, META_TESTS_START, metaTests, spliceMetaTests } from './meta-tests.js';

/** The repository root, from this module's place inside `lint/`. */
const ROOT = resolve(import.meta.dirname, '..');

/** Chapter 03, which carries the generated table. */
const CHAPTER = 'docs/03-testing.md';

describe('metaTests', () => {
    test('the meta-test channel, read off its own files — every file of the channel is a row, and every row states what it holds', () => {
        // Given - the channel as it stands on disk
        const rows = metaTests(ROOT);

        // Then - the three trees the channel lives in are all represented, and no row is a file with no describe and no test
        expect(rows.length).toBeGreaterThan(15);
        expect(rows.some((row) => row.file.startsWith('lint/self/'))).toBe(true);
        expect(rows.some((row) => row.file.startsWith('specs/lint/meta/'))).toBe(true);
        for (const row of rows) {
            expect(row.holds.length, `${row.file} declares no describe`).toBeGreaterThan(0);
            expect(row.tests, `${row.file} declares no test`).toBeGreaterThan(0);
        }
    });

    test('the meta-test channel, read off its own files — this file is one of the rows, under the title it declares', () => {
        // Given - the channel's own reading of the file you are looking at
        const own = metaTests(ROOT).find((row) => row.file === 'lint/meta-tests.test.ts');

        // Then - the row carries this file's describe, the subject C31 titles it with
        expect(own?.holds).toStrictEqual(['metaTests']);
    });

    test('the meta-test channel, read off its own files — the table in chapter 03 is byte-identical to a fresh generation', () => {
        // Given - the committed chapter
        const chapter = readFileSync(resolve(ROOT, CHAPTER), 'utf8');

        // Then - regenerating reproduces it: a hand edit between the markers fails here, correctly
        expect(spliceMetaTests(chapter, ROOT)).toBe(chapter);
        expect(chapter).toContain(META_TESTS_START);
        expect(chapter).toContain(META_TESTS_END);
    });
});
