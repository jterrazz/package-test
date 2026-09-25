import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('d10w-tokens-in-requests', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('warns when a token leaks into a requests/ file', async () => {
        // Given - a request body carrying a {{uuid}} token
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/d10w-tokens-in-requests/'))
            .exec('.');

        // Then - advisory only: the run passes (exit 0) but the full warning is on stderr. the echoed leaked token is covered by {{string}} — a literal {{uuid}} in the golden would itself be read as a placeholder by the token grammar (see D4).
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toMatch(`
            specs/widget/requests/create.http:4:1: warning jterrazz-check(d10w): found: the token {{string}} in a requests/ file · why: A known token in a file under \`requests/\` → warning: requests are inputs, never matched. · fix: write the literal value the request sends — a request is sent, never matched · read: docs/19-linting.md#d10w-tokens-in-requests
        `);
    });

    test('stays silent when requests carry no tokens', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/d10w-tokens-in-requests-ok/'))
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout, nothing on stderr
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/clean.txt'));
    });
});
