import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — c21w-ground-owned-by-one (CONVENTIONS C21)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stream is asserted, tokens covering the run cwd.
    test('warns on ground a single spec of the leaf reads', async () => {
        // Given - a tree violating C21
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c21w-ground-owned-by-one/')
            .exec('specs');

        // Then - the pass names the file and what to do about it
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('c21w-ground-owned-by-one.txt');
    });

    test('accepts ground that sits beside the spec that reads it', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c21w-ground-owned-by-one-ok/')
            .exec('specs');

        // Then - the clean summary
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('c21w-ground-owned-by-one-ok.txt');
    });
});
