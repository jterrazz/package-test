import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — j3w spec empty assertion (CONVENTIONS J3)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stderr is asserted, tokens covering the run cwd.
    test('warns about a stream that is only {{any}}', async () => {
        // Given - a run that executes and proves nothing
        const result = await cli
            .fixture('$FIXTURES/lint-violations/j3w-spec-empty-assertion/')
            .exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toMatch('j3w-spec-empty-assertion.txt');
    });

    test('accepts a document that holds the convention', async () => {
        // Given - the compliant twin every document pass shares
        const result = await cli.fixture('$FIXTURES/lint-violations/spec-document-ok/').exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });
});
