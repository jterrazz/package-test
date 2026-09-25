import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    BASELINE_FILE,
    countsOf,
    judge,
    keepsBaseline,
    keyOf,
    pluginDiagnostics,
    readBaseline,
    writeBaseline,
} from './ratchet.js';

function projectWithOxlint(output: string): string {
    const root = mkdtempSync(join(tmpdir(), 'ratchet-oxlint-'));
    mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
    const bin = join(root, 'node_modules', '.bin', 'oxlint');
    writeFileSync(join(root, 'report.json'), output);
    writeFileSync(bin, `#!/bin/sh\ncat "${join(root, 'report.json')}"\n`);
    chmodSync(bin, 0o755);
    return root;
}
describe('ratchet', () => {
    test('the test ratchet — exact counts that a fix may lower and never raise — a published code is recorded under its plugin and rule', () => {
        // Given - one code per namespace this package owns
        // Then - the key is the code spelled as a path
        expect(keyOf('jterrazz(i2-sibling-test-naming)')).toBe('jterrazz/i2-sibling-test-naming');
        expect(keyOf('jterrazz-check(c15)')).toBe('jterrazz-check/c15');
    });

    test('the test ratchet — exact counts that a fix may lower and never raise — counts every finding under its key, whatever its severity', () => {
        // Given - two findings of one rule and one of another
        // Then - one line per key
        expect(
            countsOf(['jterrazz-check(c9)', 'jterrazz-check(c9)', 'jterrazz(d16w-ambient-value)']),
        ).toStrictEqual({ 'jterrazz-check/c9': 2, 'jterrazz/d16w-ambient-value': 1 });
    });

    test('the test ratchet — exact counts that a fix may lower and never raise — breaks on grown debt, new debt, and an entry the project paid', () => {
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

    test('the test ratchet — exact counts that a fix may lower and never raise — breaks on a count below its entry: the entry states where the project stands', () => {
        // Given - the debt fell under one entry and stayed at the other
        // Then - the fall is named, with the gesture that records it
        expect(
            judge(
                { 'jterrazz-check/c9': 1, 'jterrazz/j6w': 4 },
                { 'jterrazz-check/c9': 2, 'jterrazz/j6w': 4 },
            ),
        ).toStrictEqual([
            'jterrazz-check/c9 is at 1, below its baseline of 2 — the debt fell, `--fix` re-records it',
        ]);
    });

    test('the test ratchet — exact counts that a fix may lower and never raise — holds when every count is at its entry', () => {
        // Given - each count exactly where it was recorded, and the run's own key
        // Then - nothing breaks
        expect(
            judge(
                { 'jterrazz-check/c9': 2, 'jterrazz/j6w': 4 },
                { 'jterrazz-check/c9': 2, 'jterrazz/j6w': 4, 'routes/unreached': 3 },
            ),
        ).toStrictEqual([]);
    });

    test('the test ratchet — exact counts that a fix may lower and never raise — the section sits in the family file at the project root, written sorted for a burn-down diff', () => {
        // Given - a project keeping its ratchet, and a member below it
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
        const member = join(root, 'apps', 'web');
        mkdirSync(member, { recursive: true });
        writeBaseline(root, { 'jterrazz/z': 1, 'jterrazz-check/a': 2 });

        // Then - the root keeps it and the member does not, and it reads back as written
        expect(keepsBaseline(root)).toBe(true);
        expect(keepsBaseline(member)).toBe(false);
        expect(readBaseline(root)).toStrictEqual({ 'jterrazz-check/a': 2, 'jterrazz/z': 1 });
        expect(readFileSync(join(root, BASELINE_FILE), 'utf8')).toBe(
            '{\n    "test": {\n        "jterrazz-check/a": 2,\n        "jterrazz/z": 1\n    }\n}\n',
        );
    });

    test('the test ratchet — exact counts that a fix may lower and never raise — records its section and keeps every other section byte for byte', () => {
        // Given - a family file whose typescript section is spelled its own way, and a test section to replace
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
        const typescript = '{"eslint/complexity":3,   "eslint/max-depth" : 1}';
        writeFileSync(
            join(root, BASELINE_FILE),
            `{\n  "typescript": ${typescript},\n  "test": { "jterrazz/old": 9 }\n}\n`,
        );

        // When - the test section is recorded, then recorded into a file that has none
        writeBaseline(root, { 'jterrazz/new': 1 });
        const other = mkdtempSync(join(tmpdir(), 'ratchet-'));
        writeFileSync(join(other, BASELINE_FILE), `{ "typescript": ${typescript} }`);
        writeBaseline(other, { 'jterrazz/new': 1 });

        // Then - only the test section moved, and a missing one closes the object
        expect(readFileSync(join(root, BASELINE_FILE), 'utf8')).toBe(
            `{\n  "typescript": ${typescript},\n  "test": {\n        "jterrazz/new": 1\n    }\n}\n`,
        );
        expect(readFileSync(join(other, BASELINE_FILE), 'utf8')).toBe(
            `{ "typescript": ${typescript},\n    "test": {\n        "jterrazz/new": 1\n    } }`,
        );
    });

    test("the test ratchet — exact counts that a fix may lower and never raise — the routes the run holds are the run's: never judged here, never dropped by a recording", () => {
        // Given - a test section holding a checker key and the run's route key
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
        writeFileSync(
            join(root, BASELINE_FILE),
            '{\n    "test": { "jterrazz/old": 1, "routes/unreached": 2 }\n}\n',
        );

        // When - the checker records its own counts, none of which is a route
        writeBaseline(root, { 'jterrazz/new': 1 });

        // Then - the route key is kept, and judging never asks it to be deleted
        expect(readBaseline(root)).toStrictEqual({ 'jterrazz/new': 1, 'routes/unreached': 2 });
        expect(judge({ 'jterrazz/new': 1 }, readBaseline(root))).toStrictEqual([]);
    });

    test("the test ratchet — exact counts that a fix may lower and never raise — a file holding another package's section alone keeps no test ratchet", () => {
        // Given - a family file with a typescript section only
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
        writeFileSync(join(root, BASELINE_FILE), '{ "typescript": { "eslint/complexity": 3 } }\n');

        // Then - no test section: the project keeps no ratchet of this package's
        expect(keepsBaseline(root)).toBe(false);
        expect(readBaseline(root)).toStrictEqual({});
    });

    test('the test ratchet — exact counts that a fix may lower and never raise — the retired file is never read', () => {
        // Given - a project holding only the file this package kept alone before the merge
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
        writeFileSync(join(root, 'test.baseline.json'), '{ "jterrazz-check/c9": 1 }\n');

        // Then - it keeps no test ratchet, and records nothing
        expect(keepsBaseline(root)).toBe(false);
        expect(readBaseline(root)).toStrictEqual({});
    });

    test('the test ratchet — exact counts that a fix may lower and never raise — an unreadable file records nothing rather than failing the run, and refuses a recording', () => {
        // Given - a family file that is not JSON
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
        writeFileSync(join(root, BASELINE_FILE), 'not json');

        // Then - it keeps a ratchet with no entry, so every finding reads as new debt — and a count that is no number is no entry
        expect(keepsBaseline(root)).toBe(true);
        expect(readBaseline(root)).toStrictEqual({});
        expect(() => {
            writeBaseline(root, { 'jterrazz/x': 1 });
        }).toThrow('holds no JSON object');
        writeFileSync(
            join(root, BASELINE_FILE),
            '{ "test": { "jterrazz-check/c9": "two", "jterrazz/x": 1 } }',
        );
        expect(readBaseline(root)).toStrictEqual({ 'jterrazz/x': 1 });
    });

    test("the plugin's diagnostics — judged here or nowhere — keeps the jterrazz diagnostics of the project oxlint report, and nothing else", () => {
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

    test("the plugin's diagnostics — judged here or nowhere — a project with no oxlint of its own has nothing to report", () => {
        // Given - a root with no install
        const root = mkdtempSync(join(tmpdir(), 'ratchet-bare-'));

        // Then - no diagnostic, and no oxlint borrowed from above
        expect(pluginDiagnostics(root)).toStrictEqual([]);
    });

    test("the plugin's diagnostics — judged here or nowhere — an oxlint that writes no JSON is a failure that says which binary", () => {
        // Given - a binary that prints prose
        const root = projectWithOxlint('Found 3 errors');

        // Then - the run refuses to count what it could not read
        expect(() => pluginDiagnostics(root)).toThrow(
            /for the ratchet and it wrote no JSON report/u,
        );
    });

    test("the plugin's diagnostics — judged here or nowhere — a report typescript check wrote is read, and no oxlint is run", () => {
        // Given - a project whose oxlint prints prose, and a report beside it
        const root = projectWithOxlint('Found 3 errors');
        const report = join(root, 'handed.json');
        writeFileSync(
            report,
            JSON.stringify({
                diagnostics: [
                    {
                        code: 'jterrazz(c24-ground-role)',
                        filename: 'specs/a.spec.ts',
                        labels: [{ span: { column: 9, line: 4 } }],
                        message: 'crossed',
                        severity: 'error',
                    },
                ],
            }),
        );

        // Then - the report's diagnostic, the binary never asked
        expect(pluginDiagnostics(root, report)).toStrictEqual([
            {
                code: 'jterrazz(c24-ground-role)',
                column: 9,
                file: 'specs/a.spec.ts',
                line: 4,
                message: 'crossed',
                severity: 'error',
            },
        ]);
    });

    test("the plugin's diagnostics — judged here or nowhere — a report that holds no JSON is a failure that names the file", () => {
        // Given - a handed report that is prose
        const root = mkdtempSync(join(tmpdir(), 'ratchet-report-'));
        const report = join(root, 'handed.json');
        writeFileSync(report, 'Found 3 errors');

        // Then - the run refuses to count what it could not read
        expect(() => pluginDiagnostics(root, report)).toThrow(
            /handed\.json .* holds no JSON report/u,
        );
    });
});
