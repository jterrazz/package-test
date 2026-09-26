import { describe, expect, test } from 'vitest';

import { lintReport } from './lint-report.js';

describe('lintReport', () => {
    test("lintReport — a report as a golden keeps it — keeps oxlint's position and rule, and drops its message and tally", () => {
        // Given - the unix rendering the family pins, with its tally
        const report = [
            'src/util.test.ts:1:1: a module test has a sibling module [Error/jterrazz(test-beside-its-module)]',
            'src/a.ts:3:7: Unexpected debugger [Warning/eslint(no-debugger)]',
            '',
            '2 problems',
        ].join('\n');

        // Then - one line per diagnostic, nothing else
        expect(lintReport(report)).toBe(
            'src/a.ts:3:7  eslint(no-debugger)\nsrc/util.test.ts:1:1  jterrazz(test-beside-its-module)\n',
        );
    });

    test('lintReport — a report as a golden keeps it — orders the lines by file, line and column, whatever order the linter printed them in', () => {
        // Given - the order oxlint's threads finished in: a later file first, line 10 before line 2
        const report = [
            'specs/b.ts:1:1: x [Error/jterrazz(stubs-root-holds-facades-and-kinds)]',
            'specs/a.ts:10:3: x [Error/jterrazz(stubs-root-holds-facades-and-kinds)]',
            'specs/a.ts:2:9: x [Error/jterrazz(stubs-root-holds-facades-and-kinds)]',
            'specs/a.ts:2:4: x [Error/jterrazz(stubs-root-holds-facades-and-kinds)]',
        ].join('\n');

        // Then - the order a reader walks the tree in, numbers read as numbers
        expect(lintReport(report)).toBe(
            [
                'specs/a.ts:2:4  jterrazz(stubs-root-holds-facades-and-kinds)',
                'specs/a.ts:2:9  jterrazz(stubs-root-holds-facades-and-kinds)',
                'specs/a.ts:10:3  jterrazz(stubs-root-holds-facades-and-kinds)',
                'specs/b.ts:1:1  jterrazz(stubs-root-holds-facades-and-kinds)',
                '',
            ].join('\n'),
        );
    });

    test("lintReport — a report as a golden keeps it — keeps the checker's report line the same way, and drops its summary", () => {
        // Given - two checker findings, an error and a warning, and the summary line
        const report = [
            'specs/api/orders/create.spec.ts:7:5: error jterrazz-check(no-reach-into-sibling-ground): a path may leave its leaf only into specs/_fixtures/',
            'specs/api/_requests/x.http:3:1: warning jterrazz-check(no-token-in-request): a token in a request',
            '',
            'conventions checker: 1 error(s) found under /tmp/x',
        ].join('\n');

        // Then - both channels golden alike
        expect(lintReport(report)).toBe(
            'specs/api/_requests/x.http:3:1  jterrazz-check(no-token-in-request)\nspecs/api/orders/create.spec.ts:7:5  jterrazz-check(no-reach-into-sibling-ground)\n',
        );
    });

    test('lintReport — a report as a golden keeps it — a clean run normalises to nothing', () => {
        // Given - a run that printed only its summary
        // Then - the empty text a document omits
        expect(lintReport('Found 0 warnings and 0 errors.\n')).toBe('');
    });

    test("lintReport — a report as a golden keeps it — keeps oxlint's agent line, which is the checker's", () => {
        // Given - the rendering oxlint picks in a shell that advertises an agent
        const report =
            'src/util.test.ts:1:1: error jterrazz(test-beside-its-module): a module test has a sibling module\n';

        // Then - the same golden line as the unix rendering
        expect(lintReport(report)).toBe('src/util.test.ts:1:1  jterrazz(test-beside-its-module)\n');
    });

    test("lintReport — a report as a golden keeps it — refuses oxlint's graphical rendering instead of reading it as a clean run", () => {
        // Given - the frames oxlint prints when no format is stated and no agent is advertised
        const report = [
            '  ! jterrazz(no-probe-cluster): 3 probes in one test',
            '    ,-[specs/api/events/events.test.ts:3:1]',
        ].join('\n');

        // Then - the runner is told to state the format
        expect(() => lintReport(report)).toThrow(/--format=unix or --format=agent/u);
    });
});
