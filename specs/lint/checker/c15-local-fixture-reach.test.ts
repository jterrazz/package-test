import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — c15 local fixture reach (CONVENTIONS C15)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (third-party linters) does not apply.
    test('rejects a leaf reaching into a sibling leaf ground', async () => {
        // Given - a spec whose fixture path climbs out of its own _fixtures/
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c15-local-fixture-reach/')
            .exec('.');

        // Then - the checker names the pool as the place for shared ground
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('c15-local-fixture-reach.txt');
    });

    test('accepts two leaves each reading their own ground', async () => {
        // Given - the compliant twin, each leaf with its own _fixtures/
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c15-local-fixture-reach-ok/')
            .exec('.');

        // Then - the clean summary on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });
});
