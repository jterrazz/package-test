import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — c20-facet-folder (CONVENTIONS C20)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stream is asserted, tokens covering the run cwd.
    test('rejects a facet folder with no specification', async () => {
        // Given - a tree violating C20
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c20-facet-folder/')
            .exec('specs');

        // Then - the pass names the file and what to do about it
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('c20-facet-folder.txt');
    });

    test('accepts a facet folder holding the runner it promises', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c20-facet-folder-ok/')
            .exec('specs');

        // Then - the clean summary
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('c20-facet-folder-ok.txt');
    });
});
