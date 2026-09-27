import { describe, expect, test } from 'vitest';

import { diagnosticsOf, lintReport, presetDiagnostic } from './lint-report.js';

describe('lintReport', () => {
    test("lintReport — a report as a golden keeps it — keeps oxlint's position, rule and lesson, a part per line, and drops its tally", () => {
        // Given - the unix rendering, a lesson and a plain message, and its tally
        const output = [
            'src/util.test.ts:1:1: found: a module test with no module · why: a test sits beside its module. · fix: move it · read: docs/19-linting.md#test-beside-its-module [Error/jterrazz(test-beside-its-module)]',
            'src/a.ts:3:7: Unexpected debugger [Warning/eslint(no-debugger)]',
            '',
            '2 problems',
        ].join('\n');

        // Then - the head line, then the message
        expect(lintReport(diagnosticsOf(output))).toBe(
            [
                'src/a.ts:3:7  eslint(no-debugger)',
                '    Unexpected debugger',
                'src/util.test.ts:1:1  jterrazz(test-beside-its-module)',
                '    found: a module test with no module',
                '    why: a test sits beside its module.',
                '    fix: move it',
                '    read: docs/19-linting.md#test-beside-its-module',
                '',
            ].join('\n'),
        );
    });

    test('lintReport — a report as a golden keeps it — orders the diagnostics by file, line and column, whatever order the linter printed them in', () => {
        // Given - the order oxlint's threads finished in: a later file first, line 10 before line 2
        const output = [
            'specs/b.ts:1:1: x [Error/jterrazz(stubs-root-holds-facades-and-kinds)]',
            'specs/a.ts:10:3: x [Error/jterrazz(stubs-root-holds-facades-and-kinds)]',
            'specs/a.ts:2:9: x [Error/jterrazz(stubs-root-holds-facades-and-kinds)]',
            'specs/a.ts:2:4: x [Error/jterrazz(stubs-root-holds-facades-and-kinds)]',
        ].join('\n');

        // Then - the order a reader walks the tree in, numbers read as numbers
        expect(
            lintReport(diagnosticsOf(output))
                .split('\n')
                .filter((line) => !line.startsWith(' ')),
        ).toStrictEqual([
            'specs/a.ts:2:4  jterrazz(stubs-root-holds-facades-and-kinds)',
            'specs/a.ts:2:9  jterrazz(stubs-root-holds-facades-and-kinds)',
            'specs/a.ts:10:3  jterrazz(stubs-root-holds-facades-and-kinds)',
            'specs/b.ts:1:1  jterrazz(stubs-root-holds-facades-and-kinds)',
            '',
        ]);
    });

    test("lintReport — a report as a golden keeps it — reads a checker's compiler line and oxlint's agent line alike, and drops the summary", () => {
        // Given - a checker finding, an agent-rendered warning and a summary line
        const output = [
            'specs/api/_requests/x.http:3:1: error jterrazz-check(no-token-in-request): a token in a request',
            'src/util.ts:3:1: warning eslint(no-console): Unexpected console statement.',
            '',
            'conventions checker: 1 error(s) found under /tmp/x',
        ].join('\n');

        // Then - both kept, nothing else
        expect(lintReport(diagnosticsOf(output))).toBe(
            [
                'specs/api/_requests/x.http:3:1  jterrazz-check(no-token-in-request)',
                '    a token in a request',
                'src/util.ts:3:1  eslint(no-console)',
                '    Unexpected console statement.',
                '',
            ].join('\n'),
        );
    });

    test("lintReport — a report as a golden keeps it — places a preset's finding at its position, a whole file's at 1:1", () => {
        // Given - a names finding about a folder, and an architecture finding at a line
        const diagnostics = [
            presetDiagnostic({ message: 'a stray folder', path: 'specs/stray', rule: 'names/x' }),
            presetDiagnostic({
                column: 5,
                line: 2,
                message: 'a crossing',
                path: 'src/a.ts',
                rule: 'architecture/y',
            }),
        ];

        // Then - each under its pass
        expect(lintReport(diagnostics)).toBe(
            'specs/stray:1:1  names(x)\n    a stray folder\nsrc/a.ts:2:5  architecture(y)\n    a crossing\n',
        );
    });

    test('lintReport — a report as a golden keeps it — a clean run is the empty text', () => {
        // Given - a run that printed only its summary
        // Then - nothing
        expect(lintReport(diagnosticsOf('Found 0 warnings and 0 errors.\n'))).toBe('');
    });

    test("lintReport — a report as a golden keeps it — refuses oxlint's graphical rendering instead of reading it as a clean run", () => {
        // Given - the frames oxlint prints when no format is stated and no agent is advertised
        const output = [
            '  ! jterrazz(no-probe-cluster): 3 probes in one test',
            '    ,-[specs/api/events/events.test.ts:3:1]',
        ].join('\n');

        // Then - the runner is told to state the format
        expect(() => diagnosticsOf(output)).toThrow(/--format=unix or --format=agent/u);
    });
});
