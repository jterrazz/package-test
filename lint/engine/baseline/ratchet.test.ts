import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    countsOf,
    heldUnreached,
    judge,
    keepsBaseline,
    keyOf,
    readBaseline,
    recordUnreached,
    writeBaseline,
} from './ratchet.js';

const FILE = 'jterrazz.baseline.json';

describe('ratchet', () => {
    test('the test ratchet — a published code is recorded under its plugin and rule', () => {
        // Given - one code per namespace this package owns
        // Then - the key is the code spelled as a path
        expect(keyOf('jterrazz(test-beside-its-module)')).toBe('jterrazz/test-beside-its-module');
        expect(keyOf('jterrazz-check(no-reach-into-sibling-ground)')).toBe(
            'jterrazz-check/no-reach-into-sibling-ground',
        );
    });

    test('the test ratchet — counts every finding under its key', () => {
        // Given - two findings of one rule and one of another
        // Then - one line per key
        expect(
            countsOf([
                'jterrazz-check(no-unused-ground)',
                'jterrazz-check(no-unused-ground)',
                'jterrazz(no-sampled-value-in-test)',
            ]),
        ).toStrictEqual({
            'jterrazz-check/no-unused-ground': 2,
            'jterrazz/no-sampled-value-in-test': 1,
        });
    });

    test('the test ratchet — breaks on grown debt, new debt, and an entry the project paid, naming its own gestures', () => {
        // Given - a count above its entry, one with no entry, and an entry at zero
        const broken = judge(
            { 'jterrazz-check/no-unused-ground': 3, 'jterrazz/test-beside-its-module': 1 },
            {
                'jterrazz-check/no-reach-into-sibling-ground': 2,
                'jterrazz-check/no-unused-ground': 2,
            },
        );

        // Then - three lessons, each reading the chapter of the test section
        expect(broken).toStrictEqual([
            "found: `jterrazz-check/no-unused-ground` is at 3, above its baseline of 2 · why: each count is held exactly, and a count above its entry is a regression · fix: fix the findings, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson",
            "found: `jterrazz/test-beside-its-module` has 1 finding(s) and no entry records them · why: the section holds the debt the project recorded, and a finding no entry holds is new debt · fix: fix the findings, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson",
            "found: `jterrazz-check/no-reach-into-sibling-ground` is at zero, and its entry is still recorded · why: an entry with nothing left to hold would let the debt grow back to its old count unseen · fix: run 'jterrazz-test-check --fix', which deletes the entry · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson",
        ]);
    });

    test("the test ratchet — the routes the run holds are the run's: never judged here, never dropped by a recording", () => {
        // Given - a test section holding a checker key and the run's route key
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
        writeFileSync(
            join(root, FILE),
            '{\n    "test": { "jterrazz/old": 1, "routes/unreached": 2 }\n}\n',
        );

        // When - the checker records its own counts, none of which is a route
        writeBaseline(root, { 'jterrazz/new': 1 });

        // Then - the route key is kept, and judging never asks it to be deleted
        expect(readBaseline(root)).toStrictEqual({ 'jterrazz/new': 1, 'routes/unreached': 2 });
        expect(judge({ 'jterrazz/new': 1 }, readBaseline(root))).toStrictEqual([]);
    });

    test('the test ratchet — the run records its routes beside the checker keys, and drops its key at zero', () => {
        // Given - a test section the checker wrote
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
        writeFileSync(join(root, FILE), '{\n    "test": { "jterrazz/old": 1 }\n}\n');

        // When - the run records three unreached routes, then none
        recordUnreached(root, 3);
        const held = heldUnreached(root);
        recordUnreached(root, 0);

        // Then - the count was held, and zero leaves the checker's key alone
        expect(held).toBe(3);
        expect(readBaseline(root)).toStrictEqual({ 'jterrazz/old': 1 });
    });

    test('the test ratchet — the section sits in the family file at the project root', () => {
        // Given - a project keeping its ratchet, and a member below it
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
        const member = join(root, 'apps', 'web');
        mkdirSync(member, { recursive: true });
        writeBaseline(root, { 'jterrazz/z': 1, 'jterrazz-check/a': 2 });

        // Then - the root keeps it and the member does not, and it reads back as written
        expect(keepsBaseline(root)).toBe(true);
        expect(keepsBaseline(member)).toBe(false);
        expect(readBaseline(root)).toStrictEqual({ 'jterrazz-check/a': 2, 'jterrazz/z': 1 });
        expect(readFileSync(join(root, FILE), 'utf8')).toContain('"jterrazz-check/a": 2');
    });

    test("the test ratchet — a file holding another package's section alone keeps no test ratchet", () => {
        // Given - a family file with a typescript section only
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
        writeFileSync(join(root, FILE), '{ "typescript": { "eslint/complexity": 3 } }\n');

        // Then - no test section: the project keeps no ratchet of this package's
        expect(keepsBaseline(root)).toBe(false);
        expect(readBaseline(root)).toStrictEqual({});
    });

    test('the test ratchet — an unreadable file holds no entry, so every finding is new debt, and refuses a recording', () => {
        // Given - a family file that is not JSON
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
        writeFileSync(join(root, FILE), 'not json');

        // Then - it keeps a ratchet with no entry, and a recording would lose what it holds
        expect(keepsBaseline(root)).toBe(true);
        expect(readBaseline(root)).toStrictEqual({});
        expect(() => {
            writeBaseline(root, { 'jterrazz/x': 1 });
        }).toThrow('then record again');
    });
});
