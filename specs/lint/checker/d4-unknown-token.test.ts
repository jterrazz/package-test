import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — d4 unknown token (CONVENTIONS D4)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stderr is asserted, tokens covering the run cwd.
    test('rejects an unknown token in an expected/ fixture', async () => {
        // Given - a specs tree whose text snapshot uses a token outside the frozen vocabulary
        const result = await cli.fixture('$FIXTURES/lint-violations/d4-unknown-token/').exec('.');

        // Then - the checker fails with the full diagnostic (file, token, frozen vocabulary)
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('d4-unknown-token.txt');
    });

    test('accepts fixtures using only the frozen vocabulary', async () => {
        // Given - the compliant twin ({{uuid#id}}, {{iso8601}}, {{workdir}})
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d4-unknown-token-ok/')
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });
});
