import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — d5 spec volatile literal (CONVENTIONS D5)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stderr is asserted, tokens covering the run cwd.
    test('rejects a loopback origin pinned in a stream', async () => {
        // Given - a golden carrying the port one run happened to get
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d5-spec-volatile-literal/')
            .exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('d5-spec-volatile-literal.txt');
    });

    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stderr is asserted, tokens covering the run cwd.
    test('rejects the same literal under `_expected/`, which is the other half of the reach', async () => {
        // Given - a golden file pinning a temp directory and a loopback port
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d5-ground-volatile-literal/')
            .exec('.');

        // Then - ground is judged by the list documents are judged by: one rule, one reach
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('d5-ground-volatile-literal.txt');
    });

    test('accepts every literal the document itself pinned', async () => {
        // Given - the estate's own shape: a document whose command carries the instant and the work directory it then asserts, a pool `fixture:` holding the stamp, and a sibling `_fixtures/` holding the origin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d5-pinned-by-the-document/')
            .exec('.');

        // Then - nothing is reported by either half: the defect is not the literal, it is the literal nobody pinned
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });

    test('accepts a document that holds the convention', async () => {
        // Given - the compliant twin every document pass shares
        const result = await cli.fixture('$FIXTURES/lint-violations/spec-document-ok/').exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });
});
