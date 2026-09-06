import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — c14 pool fixture shared (CONVENTIONS C14)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (third-party linters) does not apply.
    test('rejects a pool fixture only one spec directory reaches for', async () => {
        // Given - a pool entry named by a single leaf
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c14-pool-fixture-shared/')
            .exec('.');

        // Then - the checker names the leaf the fixture belongs beside
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('c14-pool-fixture-shared.txt');
    });

    test('accepts a pool fixture two leaves share', async () => {
        // Given - the compliant twin, the same entry read from two leaves
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c14-pool-fixture-shared-ok/')
            .exec('.');

        // Then - the clean summary on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });

    test('--fix moves the fixture beside its leaf and rewrites the reference', async () => {
        // Given - the same misplaced pool entry, run through the fixer
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c14-pool-fixture-shared/')
            .exec('. --fix');

        // Then - the move is announced and the re-check passes in the same run
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('c14-fixed.txt');
    });
});
