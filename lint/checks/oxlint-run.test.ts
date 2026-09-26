import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { pluginDiagnostics } from './oxlint-run.js';

function projectWithOxlint(output: string): string {
    const root = mkdtempSync(join(tmpdir(), 'oxlint-run-'));
    mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
    const bin = join(root, 'node_modules', '.bin', 'oxlint');
    writeFileSync(join(root, 'report.json'), output);
    writeFileSync(bin, `#!/bin/sh\ncat "${join(root, 'report.json')}"\n`);
    chmodSync(bin, 0o755);
    return root;
}

describe('oxlint-run', () => {
    test('pluginDiagnostics — judged here or nowhere — keeps the jterrazz diagnostics of the project oxlint report, and nothing else', () => {
        // Given - a report with one diagnostic of this plugin, one of another, and one with no span
        const root = projectWithOxlint(
            JSON.stringify({
                diagnostics: [
                    {
                        code: 'jterrazz(test-beside-its-module)',
                        filename: 'src/util.test.ts',
                        labels: [{ span: { column: 1, line: 1 } }],
                        message: 'a module test has a sibling module',
                        severity: 'error',
                    },
                    { code: 'eslint(no-debugger)', filename: 'src/a.ts', severity: 'error' },
                    { code: 'jterrazz(given-in-the-test)', severity: 'warning' },
                ],
            }),
        );

        // Then - the two of this plugin, positioned, the missing span read as the first column
        expect(pluginDiagnostics(root)).toStrictEqual([
            {
                code: 'jterrazz(test-beside-its-module)',
                column: 1,
                file: 'src/util.test.ts',
                line: 1,
                message: 'a module test has a sibling module',
                severity: 'error',
            },
            {
                code: 'jterrazz(given-in-the-test)',
                column: 1,
                file: '',
                line: 1,
                message: '',
                severity: 'warn',
            },
        ]);
    });

    test('pluginDiagnostics — judged here or nowhere — a project with no oxlint of its own has nothing to report', () => {
        // Given - a root with no install
        const root = mkdtempSync(join(tmpdir(), 'ratchet-bare-'));

        // Then - no diagnostic, and no oxlint borrowed from above
        expect(pluginDiagnostics(root)).toStrictEqual([]);
    });

    test('pluginDiagnostics — judged here or nowhere — an oxlint that writes no JSON is a failure that says which binary', () => {
        // Given - a binary that prints prose
        const root = projectWithOxlint('Found 3 errors');

        // Then - the run refuses to count what it could not read
        expect(() => pluginDiagnostics(root)).toThrow(
            /for the ratchet and it wrote no JSON report/u,
        );
    });

    test('pluginDiagnostics — judged here or nowhere — a report typescript check wrote is read, and no oxlint is run', () => {
        // Given - a project whose oxlint prints prose, and a report beside it
        const root = projectWithOxlint('Found 3 errors');
        const report = join(root, 'handed.json');
        writeFileSync(
            report,
            JSON.stringify({
                diagnostics: [
                    {
                        code: 'jterrazz(verb-reads-its-ground-folder)',
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
                code: 'jterrazz(verb-reads-its-ground-folder)',
                column: 9,
                file: 'specs/a.spec.ts',
                line: 4,
                message: 'crossed',
                severity: 'error',
            },
        ]);
    });

    test('pluginDiagnostics — judged here or nowhere — a report that holds no JSON is a failure that names the file', () => {
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
