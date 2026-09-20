import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — d21w-expected-pinned-value (CONVENTIONS D21)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stream is asserted, tokens covering the run cwd.
    test('warns on a volatile literal nothing in the leaf pins', async () => {
        // Given - a tree violating D21
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d21w-expected-pinned-value/')
            .exec('specs');

        // Then - the pass names the file and what to do about it
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('d21w-expected-pinned-value.txt');
    });

    test('accepts a golden that tokens what moves', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d21w-expected-pinned-value-ok/')
            .exec('specs');

        // Then - the clean summary
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('d21w-expected-pinned-value-ok.txt');
    });
});
