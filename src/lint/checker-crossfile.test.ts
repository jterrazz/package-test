import { describe, expect, test } from 'vitest';

import { suppressedLines } from './checker-crossfile.js';

// The cross-file passes (checkDeadFixtures / checkDatabaseProperty /
// CheckDockerRunnerAwaitUsing) read whole feature TREES off disk, so a module
// Test exercising them would need real files — a specification, not a unit
// (CONVENTIONS §I). Those live in specs/lint/checker/ as E2E goldens. What
// Stays here is the pure, code-input logic: the checker-channel suppression
// Mechanism, tested exhaustively on source strings.

describe('checker suppression — suppressedLines (checker-disable comments)', () => {
    test('disable-next-line suppresses the next NON-BLANK line, skipping blanks/comments', () => {
        // Given - a directive with a blank line before the real statement
        const text = ['// checker-disable-next-line a7 -- reason', '', 'api.seed("x.sql");'].join(
            '\n',
        );

        // Then - line 3 (the statement), not line 2 (blank), is suppressed
        expect(suppressedLines(text, 'a7')).toEqual(new Set([3]));
    });

    test('disable-line suppresses its OWN line', () => {
        // Given - a same-line directive
        const text = ['const a = 1;', 'api.seed("x.sql"); // checker-disable-line a7'].join('\n');

        // Then - line 2 is suppressed
        expect(suppressedLines(text, 'a7')).toEqual(new Set([2]));
    });

    test('a comma/space-separated id list suppresses each listed pass', () => {
        // Given - a directive naming two passes
        const text = ['// checker-disable-next-line a7, b5 -- reason', 'code();'].join('\n');

        // Then - both a7 and b5 are suppressed on line 2
        expect(suppressedLines(text, 'a7')).toEqual(new Set([2]));
        expect(suppressedLines(text, 'b5')).toEqual(new Set([2]));
        // But an unlisted pass is not
        expect(suppressedLines(text, 'c9')).toEqual(new Set());
    });

    test('the wildcard `*` suppresses every pass', () => {
        // Given - a wildcard directive
        const text = ['// checker-disable-next-line * -- blanket', 'code();'].join('\n');

        // Then - any queried id is suppressed
        expect(suppressedLines(text, 'a7')).toEqual(new Set([2]));
        expect(suppressedLines(text, 'c9')).toEqual(new Set([2]));
    });

    test('a directive naming a different pass does not suppress the queried one', () => {
        // Given - a b5-only directive
        const text = ['// checker-disable-next-line b5 -- reason', 'api.seed("x.sql");'].join('\n');

        // Then - an a7 query sees nothing suppressed
        expect(suppressedLines(text, 'a7')).toEqual(new Set());
    });

    test('the trailing `-- reason` is stripped before matching ids (reason words are not ids)', () => {
        // Given - a reason that contains the queried id as a plain word
        const text = ['// checker-disable-next-line b5 -- a7 is unrelated here', 'code();'].join(
            '\n',
        );

        // Then - "a7" inside the reason is not treated as a targeted id
        expect(suppressedLines(text, 'a7')).toEqual(new Set());
        expect(suppressedLines(text, 'b5')).toEqual(new Set([2]));
    });

    test('matching is case-insensitive (the formatter capitalizes comment leads)', () => {
        // Given - a formatter-capitalized directive
        const text = ['// Checker-disable-next-line a7 -- reason', 'code();'].join('\n');

        // Then - the capitalized form still suppresses
        expect(suppressedLines(text, 'a7')).toEqual(new Set([2]));
    });

    test('source with no directive suppresses nothing', () => {
        // Given - plain code
        const text = ['api.seed("x.sql");', 'api.table("t");'].join('\n');

        // Then - the suppression set is empty
        expect(suppressedLines(text, 'a7')).toEqual(new Set());
    });

    test('a trailing directive with no following non-blank line suppresses nothing', () => {
        // Given - a disable-next-line as the very last line
        const text = ['code();', '// checker-disable-next-line a7 -- dangling'].join('\n');

        // Then - there is no next statement to suppress
        expect(suppressedLines(text, 'a7')).toEqual(new Set());
    });
});
