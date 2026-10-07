import { describe, expect, test } from 'vitest';

import { diagnosticsOf, lintReport, presetDiagnostic } from '../lint-report.js';

describe('lintReport', () => {
    test("lintReport — a report as a golden keeps it — keeps oxlint's position, rule and lesson, a part per line, and drops its tally", () => {
        // Given - the unix rendering, a lesson and a plain message, and its tally
        const output = [
            'src/util.test.ts:1:1: found: a module test with no module · why: a test sits beside its module. · fix: move it · read: docs/reference/linting.md#test-in-its-tests-folder [Error/jterrazz(test-in-its-tests-folder)]',
            'src/a.ts:3:7: Unexpected debugger [Warning/eslint(no-debugger)]',
            '',
            '2 problems',
        ].join('\n');

        // Then - the head line, then the message
        expect(lintReport(diagnosticsOf(output))).toBe(
            [
                'src/a.ts:3:7  eslint(no-debugger)',
                '    Unexpected debugger',
                'src/util.test.ts:1:1  jterrazz(test-in-its-tests-folder)',
                '    found: a module test with no module',
                '    why: a test sits beside its module.',
                '    fix: move it',
                '    read: docs/reference/linting.md#test-in-its-tests-folder',
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
            'specs/api/__requests__/x.http:3:1: error jterrazz-check(no-token-in-request): a token in a request',
            'src/util.ts:3:1: warning eslint(no-console): Unexpected console statement.',
            '',
            'conventions checker: 1 error(s) found under /tmp/x',
        ].join('\n');

        // Then - both kept, nothing else
        expect(lintReport(diagnosticsOf(output))).toBe(
            [
                'specs/api/__requests__/x.http:3:1  jterrazz-check(no-token-in-request)',
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
        expect(() => diagnosticsOf(output)).toThrow(
            new Error(
                [
                    "found: a report in oxlint's graphical rendering (! jterrazz(no-probe-cluster): 3 probes in one test)",
                    'why: A report is read one line per diagnostic.',
                    'fix: run oxlint with --format=unix or --format=agent: without it, oxlint picks its renderer off the environment',
                    'read: docs/guides/lint-specs.md#the-report',
                ].join('\n'),
            ),
        );
    });

    test('lintReport — a report as a golden keeps it — findings at one place are ordered by rule and message, a file named with a colon keeps it, a nested rule name keeps its path, and a lesson keeps only the parts it states', () => {
        // Given - two findings at one place, a file whose name holds a colon, a rule name of two segments, a lesson with no read part
        const diagnostics = [
            presetDiagnostic({ column: 2, line: 3, message: 'aa', path: 'a.ts', rule: 'layers/y' }),
            presetDiagnostic({ column: 2, line: 1, message: 'a', path: 'a.ts', rule: 'names/z' }),
            presetDiagnostic({ column: 2, line: 1, message: 'c', path: 'a.ts', rule: 'layers/y' }),
            presetDiagnostic({ column: 2, line: 1, message: 'b', path: 'a.ts', rule: 'names/z' }),
            presetDiagnostic({
                column: 1,
                line: 3,
                message: 'found: f · why: w · fix: x',
                path: 'c:d.ts',
                rule: 'names/one/two',
            }),
            presetDiagnostic({
                column: 9,
                line: 1,
                message: 'later',
                path: 'a.ts',
                rule: 'names/z',
            }),
            presetDiagnostic({
                column: 1,
                line: 2,
                message: 'below',
                path: 'a.ts',
                rule: 'names/z',
            }),
            presetDiagnostic({ column: 1, line: 1, message: 'x', path: 'b;.ts', rule: 'names/z' }),
            presetDiagnostic({ column: 1, line: 1, message: 'x', path: 'b:x.ts', rule: 'names/z' }),
        ];

        // Then - the whole report in order
        expect(lintReport(diagnostics)).toBe(
            [
                'a.ts:1:2  layers(y)',
                '    c',
                'a.ts:1:2  names(z)',
                '    a',
                'a.ts:1:2  names(z)',
                '    b',
                'a.ts:1:9  names(z)',
                '    later',
                'a.ts:2:1  names(z)',
                '    below',
                'a.ts:3:2  layers(y)',
                '    aa',
                'b:x.ts:1:1  names(z)',
                '    x',
                'b;.ts:1:1  names(z)',
                '    x',
                'c:d.ts:3:1  names(one/two)',
                '    found: f',
                '    why: w',
                '    fix: x',
                '',
            ].join('\n'),
        );
    });

    test('lintReport — a report as a golden keeps it — reads a diagnostic only from a line that is one whole, whatever its numbers', () => {
        // Given - a unix and a compiler line at two-digit positions, each also with a word before it and after it, and a graphical head no line starts with
        const output = [
            'src/a.ts:12:34: Unexpected debugger [Warning/eslint(no-debugger)]',
            'note: src/a.ts:1:1: Unexpected debugger [Warning/eslint(no-debugger)]',
            'src/a.ts:1:1: Unexpected debugger [Warning/eslint(no-debugger)] (2 more)',
            'src/b.ts:56:78: error jterrazz-check(no-token-in-request): a token',
            'note: src/b.ts:1:1: error jterrazz-check(no-token-in-request): a token',
            'see   x eslint(no-debugger): in a sentence',
        ].join('\n');

        // Then - the two whole lines, at their positions, and nothing of the others
        expect(diagnosticsOf(output)).toStrictEqual([
            { at: 'src/a.ts:12:34', message: 'Unexpected debugger', rule: 'eslint(no-debugger)' },
            {
                at: 'src/b.ts:56:78',
                message: 'a token',
                rule: 'jterrazz-check(no-token-in-request)',
            },
        ]);
    });
});
