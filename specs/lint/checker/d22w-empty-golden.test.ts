import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — d22w-empty-golden (CONVENTIONS D22)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stream is asserted, tokens covering the run cwd.
    test('warns on a golden that asserts nothing', async () => {
        // Given - a tree violating D22
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d22w-empty-golden/')
            .exec('specs');

        // Then - the pass names the file and what to do about it
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('d22w-empty-golden.txt');
    });

    test('accepts a golden that states the answer', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d22w-empty-golden-ok/')
            .exec('specs');

        // Then - the clean summary
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('d22w-empty-golden-ok.txt');
    });
});
