import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — d4b http first line (CONVENTIONS D4b)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (third-party linters) does not apply.
    test('rejects a requests/*.http without a request line', async () => {
        // Given - a request fixture whose first line is not "METHOD /path"
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d4b-http-first-line/')
            .exec('.');

        // Then - the checker fails with the full D4b grammar diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('d4b-http-first-line.txt');
    });

    test('accepts well-formed request and status lines', async () => {
        // Given - the compliant twin (request line + status line)
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d4b-http-first-line-ok/')
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });
});
