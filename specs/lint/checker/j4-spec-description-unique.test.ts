import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — j4 spec description unique (CONVENTIONS J4)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stderr is asserted, tokens covering the run cwd.
    test('rejects two documents of one directory sharing a description', async () => {
        // Given - two .spec.yaml files whose description: is the same sentence
        const result = await cli
            .fixture('$FIXTURES/lint-violations/j4-spec-description-unique/')
            .exec('.');

        // Then - the second one is named, with the first it collides with
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('j4-spec-description-unique.txt');
    });

    test('accepts a document that holds the convention', async () => {
        // Given - the compliant twin every document pass shares
        const result = await cli.fixture('$FIXTURES/lint-violations/spec-document-ok/').exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });
});
