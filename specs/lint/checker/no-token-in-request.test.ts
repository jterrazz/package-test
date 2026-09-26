import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('no-token-in-request', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('warns when a token leaks into a _requests/ file', async () => {
        // Given - a request body carrying a {{uuid}} token
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/no-token-in-request/'))
            .exec('.');

        // Then - advisory only: the run passes (exit 0) but the full warning is on stderr. the echoed leaked token is covered by {{string}} — a literal {{uuid}} in the golden would itself be read as a placeholder by the token grammar (see `no-unknown-token`).
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toMatch(`
            specs/widget/_requests/create.http:4:1: warning jterrazz-check(no-token-in-request): found: the token {{string}} in a _requests/ file · why: A known token in a file under \`_requests/\` → warning: requests are inputs, never matched. · fix: write the literal value the request sends — a request is sent, never matched · read: docs/19-linting.md#no-token-in-request
        `);
    });

    test('stays silent when requests carry no tokens', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/no-token-in-request-ok/'))
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout, nothing on stderr
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./_expected/clean.txt'));
    });
});
