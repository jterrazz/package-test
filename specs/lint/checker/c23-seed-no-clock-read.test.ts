import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — c23-seed-no-clock-read (CONVENTIONS C23)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stream is asserted, tokens covering the run cwd.
    test('rejects every spelling of a clock read, and reads past a comment', async () => {
        // Given - a seed writing `datetime('now', …)`, `CURRENT_TIMESTAMP` and `NOW()`, under a comment that names one of them
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c23-seed-no-clock-read/')
            .exec('specs');

        // Then - three findings, one per row, and none for the comment
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('c23-seed-no-clock-read.txt');
    });

    test('accepts a seed that states the instants the case is about', async () => {
        // Given - the compliant twin, whose chain pins the run's clock instead
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c23-seed-no-clock-read-ok/')
            .exec('specs');

        // Then - the clean summary
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('c23-seed-no-clock-read-ok.txt');
    });
});
