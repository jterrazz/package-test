import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — d4b spec key order (CONVENTIONS D4b)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stderr is asserted, tokens covering the run cwd.
    test('rejects a document whose runs sit above its env', async () => {
        // Given - a document declaring runs: before env:
        const result = await cli.fixture('$FIXTURES/lint-violations/d4b-spec-key-order/').exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('d4b-spec-key-order.txt');
    });

    test('accepts a document that holds the convention', async () => {
        // Given - the compliant twin every document pass shares
        const result = await cli.fixture('$FIXTURES/lint-violations/spec-document-ok/').exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });
});
