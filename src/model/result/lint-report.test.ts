import { describe, expect, test } from 'vitest';

import { lintReport } from './lint-report.js';

describe('lintReport — a report as a golden keeps it', () => {
    test("keeps oxlint's position and rule, and drops its message and tally", () => {
        // Given - the unix rendering the family pins, with its tally
        const report = [
            'src/util.test.ts:1:1: a module test has a sibling module [Error/jterrazz(i2-sibling-test-naming)]',
            'src/a.ts:3:7: Unexpected debugger [Warning/eslint(no-debugger)]',
            '',
            '2 problems',
        ].join('\n');

        // Then - one line per diagnostic, nothing else
        expect(lintReport(report)).toBe(
            'src/util.test.ts:1:1  jterrazz(i2-sibling-test-naming)\nsrc/a.ts:3:7  eslint(no-debugger)\n',
        );
    });

    test("keeps the checker's report line the same way, and drops its summary", () => {
        // Given - two checker findings, an error and a warning, and the summary line
        const report = [
            'specs/api/orders/create.spec.ts:7:5: error jterrazz-check(c15): a path may leave its leaf only into specs/fixtures/',
            'specs/api/requests/x.http:3:1: warning jterrazz-check(d10): a token in a request',
            '',
            'conventions checker: 1 error(s) found under /tmp/x',
        ].join('\n');

        // Then - both channels golden alike
        expect(lintReport(report)).toBe(
            'specs/api/orders/create.spec.ts:7:5  jterrazz-check(c15)\nspecs/api/requests/x.http:3:1  jterrazz-check(d10)\n',
        );
    });

    test('a clean run normalises to nothing', () => {
        // Given - a run that printed only its summary
        // Then - the empty text a document omits
        expect(lintReport('Found 0 warnings and 0 errors.\n')).toBe('');
    });
});
