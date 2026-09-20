import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — c16-document-outside-ground (CONVENTIONS C16)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stream is asserted, tokens covering the run cwd.
    test('rejects a document filed under ground', async () => {
        // Given - a tree violating C16
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c16-document-outside-ground/')
            .exec('specs');

        // Then - the pass names the file and what to do about it
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('c16-document-outside-ground.txt');
    });

    test('accepts a document beside the test that runs it', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/spec-document-ok/')
            .exec('specs');

        // Then - the clean summary
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('c16-document-outside-ground-ok.txt');
    });
});
