import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    countsOf,
    judge,
    keepsBaseline,
    keyOf,
    pluginDiagnostics,
    readBaseline,
    TEST_BASELINE,
    writeBaseline,
} from './ratchet.js';

describe('the test ratchet — counts that may fall and never rise', () => {
    test('a published code is recorded under its plugin and rule', () => {
        // Given - one code per namespace this package owns
        // Then - the key is the code spelled as a path
        expect(keyOf('jterrazz(i2-sibling-test-naming)')).toBe('jterrazz/i2-sibling-test-naming');
        expect(keyOf('jterrazz-check(c15)')).toBe('jterrazz-check/c15');
    });

    test('counts every finding under its key, whatever its severity', () => {
        // Given - two findings of one rule and one of another
        // Then - one line per key
        expect(
            countsOf(['jterrazz-check(c9)', 'jterrazz-check(c9)', 'jterrazz(d16w-ambient-value)']),
        ).toStrictEqual({ 'jterrazz-check/c9': 2, 'jterrazz/d16w-ambient-value': 1 });
    });

    test('breaks on grown debt, new debt, and an entry the project paid', () => {
        // Given - a count above its entry, one with no entry, and an entry at zero
        const broken = judge(
            { 'jterrazz-check/c9': 3, 'jterrazz/i2-sibling-test-naming': 1 },
            { 'jterrazz-check/c15': 2, 'jterrazz-check/c9': 2 },
        );

        // Then - three reasons, in the order a reader scans them
        expect(broken).toStrictEqual([
            'jterrazz-check/c9 is at 3, above its baseline of 2',
            'jterrazz/i2-sibling-test-naming has 1 finding(s) and no entry — it is new debt',
            'jterrazz-check/c15 is at zero — the ratchet moved, delete its entry',
        ]);
    });

    test('holds when every count is within its entry', () => {
        // Given - the debt fell under one entry and stayed under the other
        // Then - nothing breaks
        expect(
            judge(
                { 'jterrazz-check/c9': 1, 'jterrazz/j6w': 4 },
                { 'jterrazz-check/c9': 2, 'jterrazz/j6w': 4 },
            ),
        ).toStrictEqual([]);
    });

    test('the file sits at the project root, written sorted for a burn-down diff', () => {
        // Given - a project keeping its ratchet, and a member below it
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
        const member = join(root, 'apps', 'web');
        mkdirSync(member, { recursive: true });
        writeBaseline(root, { 'jterrazz/z': 1, 'jterrazz-check/a': 2 });

        // Then - the root keeps it and the member does not, and it reads back as written
        expect(keepsBaseline(root)).toBeTruthy();
        expect(keepsBaseline(member)).toBeFalsy();
        expect(readBaseline(root)).toStrictEqual({ 'jterrazz-check/a': 2, 'jterrazz/z': 1 });
        expect(readFileSync(join(root, TEST_BASELINE), 'utf8')).toBe(
            '{\n    "jterrazz-check/a": 2,\n    "jterrazz/z": 1\n}\n',
        );
    });

    test('an unreadable file records nothing rather than failing the run', () => {
        // Given - a baseline that is not JSON
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
        writeFileSync(join(root, TEST_BASELINE), 'not json');

        // Then - no entry, so every finding reads as new debt — and a count that is no number is no entry
        expect(readBaseline(root)).toStrictEqual({});
        writeFileSync(join(root, TEST_BASELINE), '5');
        expect(readBaseline(root)).toStrictEqual({});
        writeFileSync(join(root, TEST_BASELINE), '{ "jterrazz-check/c9": "two", "jterrazz/x": 1 }');
        expect(readBaseline(root)).toStrictEqual({ 'jterrazz/x': 1 });
    });
});

/** A project whose `node_modules/.bin/oxlint` prints `output` — the binary the ratchet runs. */
function projectWithOxlint(output: string): string {
    const root = mkdtempSync(join(tmpdir(), 'ratchet-oxlint-'));
    mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
    const bin = join(root, 'node_modules', '.bin', 'oxlint');
    writeFileSync(join(root, 'report.json'), output);
    writeFileSync(bin, `#!/bin/sh\ncat "${join(root, 'report.json')}"\n`);
    chmodSync(bin, 0o755);
    return root;
}

describe("the plugin's diagnostics — judged here or nowhere", () => {
    test('keeps the jterrazz diagnostics of the project oxlint report, and nothing else', () => {
        // Given - a report with one diagnostic of this plugin, one of another, and one with no span
        const root = projectWithOxlint(
            JSON.stringify({
                diagnostics: [
                    {
                        code: 'jterrazz(i2-sibling-test-naming)',
                        filename: 'src/util.test.ts',
                        labels: [{ span: { column: 1, line: 1 } }],
                        message: 'a module test has a sibling module',
                        severity: 'error',
                    },
                    { code: 'eslint(no-debugger)', filename: 'src/a.ts', severity: 'error' },
                    { code: 'jterrazz(j6w-given-in-the-test)', severity: 'warning' },
                ],
            }),
        );

        // Then - the two of this plugin, positioned, the missing span read as the first column
        expect(pluginDiagnostics(root)).toStrictEqual([
            {
                code: 'jterrazz(i2-sibling-test-naming)',
                column: 1,
                file: 'src/util.test.ts',
                line: 1,
                message: 'a module test has a sibling module',
                severity: 'error',
            },
            {
                code: 'jterrazz(j6w-given-in-the-test)',
                column: 1,
                file: '',
                line: 1,
                message: '',
                severity: 'warn',
            },
        ]);
    });

    test('a project with no oxlint of its own has nothing to report', () => {
        // Given - a root with no install
        const root = mkdtempSync(join(tmpdir(), 'ratchet-bare-'));

        // Then - no diagnostic, and no oxlint borrowed from above
        expect(pluginDiagnostics(root)).toStrictEqual([]);
    });

    test('an oxlint that writes no JSON is a failure that says which binary', () => {
        // Given - a binary that prints prose
        const root = projectWithOxlint('Found 3 errors');

        // Then - the run refuses to count what it could not read
        expect(() => pluginDiagnostics(root)).toThrow(
            /for the ratchet and it wrote no JSON report/u,
        );
    });
});
