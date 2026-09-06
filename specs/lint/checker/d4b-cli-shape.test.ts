import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — d4b cli shape (CONVENTIONS D4b)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stderr is asserted, tokens covering the run cwd.
    test('rejects a header key outside the closed set', async () => {
        // Given - a <case>.cli carrying a `when:` line
        const result = await cli.fixture('$FIXTURES/lint-violations/d4b-cli-shape/').exec('.');

        // Then - the grammar the runner parses is the grammar the lint enforces
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('d4b-cli-shape.txt');
    });

    test('the same grammar is what the compliant twin satisfies', async () => {
        // Given - a well-formed literate spec (the b4 twin doubles as D4b's)
        const result = await cli.fixture('$FIXTURES/lint-violations/b4-cli-header-ok/').exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });
});
