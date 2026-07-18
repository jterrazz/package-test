import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — b5 await-using inference (CONVENTIONS B5)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (third-party linters) does not apply.
    test('rejects a docker runner result bound without await using', async () => {
        // Given - a docker-aware spec and a test binding its result with const
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b5-await-using-inference/')
            .exec('.');

        // Then - the checker fails with the full diagnostic naming the runner
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('b5-await-using-inference.txt');
    });

    test('accepts a docker runner result bound with await using', async () => {
        // Given - the compliant twin (await using)
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b5-await-using-inference-ok/')
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });
});
