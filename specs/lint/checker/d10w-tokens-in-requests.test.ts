import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — d10w tokens in requests (CONVENTIONS D10)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (third-party linters) does not apply.
    test('warns when a token leaks into a requests/ file', async () => {
        // Given - a request body carrying a {{uuid}} token
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d10w-tokens-in-requests/')
            .exec('.');

        // Then - advisory only: the run passes (exit 0) but the full warning is on stderr.
        // The echoed leaked token is covered by {{string}} — a literal {{uuid}} in the
        // Golden would itself be read as a placeholder by the token grammar (see D4).
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toMatch('d10w-tokens-in-requests.txt');
    });

    test('stays silent when requests carry no tokens', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d10w-tokens-in-requests-ok/')
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout, nothing on stderr
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });
});
