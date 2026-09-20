import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — c18-module-test-under-facet (CONVENTIONS C18)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stream is asserted, tokens covering the run cwd.
    test('rejects a spec that reaches no runner under its facet', async () => {
        // Given - a tree violating C18
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c18-module-test-under-facet/')
            .exec('specs');

        // Then - the pass names the file and what to do about it
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('c18-module-test-under-facet.txt');
    });

    test('accepts a spec that imports the runner of its facet', async () => {
        // Given - the compliant twin, whose second spec names the specification module with no extension
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c18-module-test-under-facet-ok/')
            .exec('specs');

        // Then - the clean summary: the import SOURCE is what reaches the runner, however it spells the extension
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('c18-module-test-under-facet-ok.txt');
    });
});
